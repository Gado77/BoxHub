import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { AsaasBillingProvider } from '@/lib/billing';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { asaas } from '@/lib/asaas';

export async function POST(request: Request) {
  try {
    // 1. Rate Limiting (10 attempts per hour per IP)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limiter = await rateLimit(ip, 10, 60 * 60 * 1000);
    if (!limiter.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas tentativas de checkout. Tente novamente mais tarde.' }),
        { 
          status: 429, 
          headers: { 
            'Retry-After': Math.ceil((limiter.reset - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json'
          } 
        }
      );
    }

    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não configurado.' }, { status: 500 });
    }

    // 2. Validar sessão
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 3. Buscar perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    const orgId = profile.organization_id;

    // 4. Buscar organização e assinatura atual
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, asaas_customer_id, subscription_status, settings')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 });
    }

    // 4.1. Bloquear novas trocas de plano se a conta estiver marcada para revisão financeira
    if (org.settings && (org.settings as any).needs_financial_review === true) {
      return NextResponse.json(
        { error: 'Sua conta está sob revisão financeira devido a uma falha no processamento do upgrade. Por favor, entre em contato com o suporte para regularizar a situação.' },
        { status: 403 }
      );
    }

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', orgId)
      .single();

    const body = await request.json().catch(() => ({}));
    const priceId = body.priceId;
    let plan = body.plan || 'pro';
    let cycle: 'monthly' | 'annual' = body.cycle || 'monthly';

    // Se o cliente enviar priceId (legado ou vindo do botão da UI), mapeia para plano/ciclo
    if (priceId) {
      const basicMonthly = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC || 'price_basic_monthly';
      const basicAnnual = process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_ANNUAL || 'price_basic_annual';
      const proAnnual = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual';

      if (priceId === basicMonthly) {
        plan = 'basic';
        cycle = 'monthly';
      } else if (priceId === basicAnnual) {
        plan = 'basic';
        cycle = 'annual';
      } else if (priceId === proAnnual) {
        plan = 'pro';
        cycle = 'annual';
      } else {
        plan = 'pro';
        cycle = 'monthly';
      }
    }

    // 4.2. Janela curta de idempotência (ex: 5 segundos) por organization_id + requested_plan + billing_cycle
    const idempotencyKey = `idem:${orgId}:${plan}:${cycle}`;
    const idempCheck = await rateLimit(idempotencyKey, 1, 5000);
    if (!idempCheck.success) {
      return NextResponse.json(
        { error: 'Requisição em processamento. Por favor, aguarde alguns instantes.' },
        { status: 409 }
      );
    }

    // 4.5. Validações de Troca de Plano e Faturas Pendentes
    if (subscription) {
      // A. Mesmo plano/ciclo (não pode criar nova assinatura, retorna fatura/portal existente ou erro)
      if (subscription.plan === plan && subscription.billing_cycle === cycle && subscription.asaas_subscription_id) {
        try {
          const payments = await asaas.getSubscriptionPayments(subscription.asaas_subscription_id);
          const pending = payments.find((p) => ['PENDING', 'OVERDUE'].includes(p.status));
          if (pending) {
            console.log(`[Asaas Checkout] Mesmo plano/ciclo. Retornando fatura pendente: ${pending.invoiceUrl}`);
            return NextResponse.json({ url: pending.invoiceUrl });
          }
          if (payments.length > 0) {
            console.log(`[Asaas Checkout] Mesmo plano/ciclo. Retornando fatura existente: ${payments[0].invoiceUrl}`);
            return NextResponse.json({ url: payments[0].invoiceUrl });
          }
        } catch (e: any) {
          console.error('[Asaas Checkout] Erro ao buscar pagamentos de assinatura existente:', e.message);
        }

        return NextResponse.json(
          { error: 'Você já possui uma assinatura ativa para este mesmo plano e ciclo.' },
          { status: 400 }
        );
      }

      // B. Cobrança pendente (não pode criar nova assinatura, retorna a fatura pendente ou erro)
      if (['past_due', 'unpaid', 'incomplete'].includes(subscription.status) && subscription.asaas_subscription_id) {
        try {
          const payments = await asaas.getSubscriptionPayments(subscription.asaas_subscription_id);
          const pending = payments.find((p) => ['PENDING', 'OVERDUE'].includes(p.status));
          if (pending) {
            console.log(`[Asaas Checkout] Cobrança pendente encontrada. Retornando fatura: ${pending.invoiceUrl}`);
            return NextResponse.json({ url: pending.invoiceUrl });
          }
          if (payments.length > 0) {
            console.log(`[Asaas Checkout] Cobrança pendente: retornando última fatura: ${payments[0].invoiceUrl}`);
            return NextResponse.json({ url: payments[0].invoiceUrl });
          }
        } catch (e: any) {
          console.error('[Asaas Checkout] Erro ao buscar pagamentos para cobrança pendente:', e.message);
        }

        return NextResponse.json(
          { error: 'Você possui uma cobrança pendente no Asaas. Por favor, regularize o pagamento antes de trocar de plano ou criar uma nova assinatura.' },
          { status: 400 }
        );
      }

      // C. Downgrade Pro -> Básico: Bloqueado no automático
      if (subscription.plan === 'pro' && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(subscription.status) && plan === 'basic') {
        return NextResponse.json(
          { error: 'Downgrade automático não permitido. Por favor, entre em contato com o suporte para agendar o downgrade para o final do período vigente da sua assinatura Pro.' },
          { status: 400 }
        );
      }
    }

    // C. Upgrade Básico -> Pro (criar primeiro, depois cancelar)
    let isUpgrade = false;
    let oldSubscriptionIdToCancel = '';
    let isWithin7Days = false;

    if (subscription && subscription.plan === 'basic' && ['active', 'trialing'].includes(subscription.status) && plan === 'pro') {
      isUpgrade = true;
      oldSubscriptionIdToCancel = subscription.asaas_subscription_id || '';
      
      // Regra de 7 dias: calcular pela data do pagamento/fatura no Asaas
      if (oldSubscriptionIdToCancel) {
        try {
          console.log(`[Asaas Checkout] Consultando faturas no Asaas para a regra de reembolso de 7 dias...`);
          const oldPayments = await asaas.getSubscriptionPayments(oldSubscriptionIdToCancel);
          const paidPayment = oldPayments.find((p) => ['RECEIVED', 'CONFIRMED'].includes(p.status));
          
          if (paidPayment) {
            const paymentDateStr = paidPayment.paymentDate || paidPayment.confirmedDate || '';
            if (paymentDateStr) {
              const paymentTime = new Date(paymentDateStr).getTime();
              const diffDays = (Date.now() - paymentTime) / (1000 * 60 * 60 * 24);
              isWithin7Days = diffDays <= 7;
              console.log(`[Asaas Checkout] Elegibilidade calculada pela data do pagamento no Asaas: ${paymentDateStr}. Dias desde o pagamento: ${diffDays.toFixed(2)}. Reembolso elegível: ${isWithin7Days}`);
            }
          }
        } catch (e: any) {
          console.error('[Asaas Checkout] Falha ao consultar faturas no Asaas para reembolso. Utilizando fallback local:', e.message);
        }
      }

      // Fallback local caso não tenha conseguido obter data do pagamento do Asaas
      if (!isWithin7Days) {
        const createdTime = new Date(subscription.created_at || subscription.updated_at || new Date()).getTime();
        const diffDays = (Date.now() - createdTime) / (1000 * 60 * 60 * 24);
        isWithin7Days = diffDays <= 7;
        console.log(`[Asaas Checkout] Usando fallback local para cálculo dos 7 dias. Criado há: ${diffDays.toFixed(2)} dias. Elegível: ${isWithin7Days}`);
      }
    }

    const provider = new AsaasBillingProvider();
    let asaasCustomerId = org.asaas_customer_id;

    // 5. Criar cliente no Asaas se não existir
    if (!asaasCustomerId) {
      const userEmail = profile.email || user.email || '';
      const orgName = org.name || 'Cliente BoxHub';
      
      console.log(`[Asaas Checkout] Criando cliente no Asaas para a organização ${orgId}`);
      asaasCustomerId = await provider.createCustomer(orgId, userEmail, orgName);

      // Sincronizar asaas_customer_id nas tabelas organizations e subscriptions
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('organizations')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', orgId);

        await supabaseAdmin
          .from('subscriptions')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('company_id', orgId);
      }
    }

    // 5.5. Consultar assinaturas/cobranças no Asaas e bloquear se houver assinatura ativa ou pendente
    if (asaasCustomerId) {
      try {
        console.log(`[Asaas Checkout] Verificando assinaturas e faturas no Asaas para o customer: ${asaasCustomerId}`);
        const asaasSubs = await asaas.getCustomerSubscriptions(asaasCustomerId);
        
        // Bloquear se houver assinatura ativa ou pendente não reconciliada (ignorar a que vamos cancelar no upgrade)
        const activeSubs = asaasSubs.filter(sub => 
          ['ACTIVE', 'ACTIVE_DELINQUENT'].includes(sub.status.toUpperCase()) && 
          (!isUpgrade || sub.id !== oldSubscriptionIdToCancel)
        );
        
        if (activeSubs.length > 0) {
          console.warn(`[Asaas Checkout] Bloqueando: assinatura ativa encontrada no Asaas (${activeSubs[0].id})`);
          return NextResponse.json(
            { error: 'Você já possui uma assinatura ativa no Asaas. Por favor, gerencie sua cobrança pelo portal ou fale com o suporte.' },
            { status: 400 }
          );
        }

        const customerPayments = await asaas.getCustomerPayments(asaasCustomerId);
        const pendingPayments = customerPayments.filter(p => ['PENDING', 'OVERDUE'].includes(p.status.toUpperCase()));
        
        if (pendingPayments.length > 0) {
          console.warn(`[Asaas Checkout] Bloqueando: cobrança pendente encontrada no Asaas (${pendingPayments[0].id})`);
          return NextResponse.json({ 
            url: pendingPayments[0].invoiceUrl,
            error: 'Você possui uma cobrança pendente no Asaas. Por favor, regularize o pagamento para prosseguir.'
          });
        }
      } catch (e: any) {
        console.error('[Asaas Checkout] Erro operacional ao checar assinaturas do Asaas:', e.message);
        return NextResponse.json(
          { error: `Erro de comunicação com o Asaas ao validar assinatura ativa: ${e.message}. Tente novamente.` },
          { status: 500 }
        );
      }
    }

    // 6. Criar assinatura recorrente no Asaas
    console.log(`[Asaas Checkout] Criando assinatura Asaas para cliente: ${asaasCustomerId}, Plano: ${plan}, Ciclo: ${cycle}`);
    const trialEndsAt = subscription?.trial_ends_at;
    const { url, subscriptionId } = await provider.createSubscription(
      orgId,
      asaasCustomerId,
      priceId || '',
      plan,
      cycle,
      trialEndsAt
    );

    // Tratamento pós-criação de upgrade Básico -> Pro (Criar primeiro, depois cancelar)
    if (isUpgrade && oldSubscriptionIdToCancel) {
      let refundError = null;
      let refundSuccess = false;
      let refundPaymentId = null;

      if (isWithin7Days) {
        try {
          console.log(`[Asaas Checkout] Buscando faturas da assinatura antiga ${oldSubscriptionIdToCancel} para estorno...`);
          const oldPayments = await asaas.getSubscriptionPayments(oldSubscriptionIdToCancel);
          const paidPayment = oldPayments.find((p) => ['RECEIVED', 'CONFIRMED'].includes(p.status));
          
          if (paidPayment) {
            refundPaymentId = paidPayment.id;
            console.log(`[Asaas Checkout] Tentando estornar o pagamento: ${paidPayment.id}`);
            await asaas.refundPayment(paidPayment.id, paidPayment.value, 'Estorno por upgrade para plano Pro em até 7 dias');
            refundSuccess = true;
            console.log(`[Asaas Checkout] Estorno de R$ ${paidPayment.value} realizado com sucesso!`);
          } else {
            console.log('[Asaas Checkout] Nenhum pagamento confirmado encontrado para estorno.');
          }
        } catch (e: any) {
          refundError = e.message || 'Erro desconhecido';
          console.error(`[Asaas Checkout] Tentativa de reembolso falhou: ${refundError}`);
        }
      }

      // Cancelar a assinatura básica
      let cancelError = null;
      try {
        console.log(`[Asaas Checkout] Cancelando assinatura Básico antiga: ${oldSubscriptionIdToCancel}`);
        await asaas.cancelSubscription(oldSubscriptionIdToCancel);
      } catch (e: any) {
        cancelError = e.message || 'Erro desconhecido';
        console.error(`[Asaas Checkout] Falha ao cancelar assinatura antiga ${oldSubscriptionIdToCancel}:`, e.message);
      }

      // Registrar logs de auditoria
      if (supabaseAdmin) {
        let logMessage = '';
        if (isWithin7Days) {
          if (refundSuccess) {
            logMessage = 'Upgrade para Pro com reembolso do Básico solicitado (dentro de 7 dias)';
          } else if (refundError) {
            logMessage = `Upgrade para Pro realizado. Tentativa de reembolso falhou: ${refundError}. Favor realizar reembolso manual`;
          } else {
            logMessage = 'Upgrade para Pro realizado (sem fatura paga para reembolsar dentro de 7 dias)';
          }
        } else {
          logMessage = 'Upgrade para Pro realizado sem reembolso (passados 7 dias)';
        }

        if (cancelError) {
          logMessage += `. Falha ao cancelar assinatura antiga automaticamente: ${cancelError}. Favor cancelar manualmente.`;

          // 1. Marcar estado de revisão financeira em settings da organização
          try {
            const currentSettings = org.settings || {};
            const newSettings = { ...currentSettings, needs_financial_review: true };
            await supabaseAdmin
              .from('organizations')
              .update({ settings: newSettings })
              .eq('id', orgId);
            console.log(`[Asaas Checkout] Organização ${orgId} marcada como 'needs_financial_review: true'`);
          } catch (e: any) {
            console.error(`[Asaas Checkout] Erro ao atualizar settings da organização ${orgId}:`, e.message);
          }

          // 2. Criar notificação interna crítica
          try {
            await supabaseAdmin
              .from('notifications')
              .insert({
                organization_id: orgId,
                user_id: null,
                title: 'Revisão Financeira Necessária',
                message: `O upgrade para o plano Pro foi concluído no Asaas, mas a assinatura básica antiga (${oldSubscriptionIdToCancel}) não pôde ser cancelada automaticamente. Detalhes: ${cancelError}.`,
                description: 'O Box foi colocado em estado de revisão financeira. Por favor, cancele a assinatura antiga manualmente no painel do Asaas e entre em contato com o suporte.',
                type: 'billing',
                priority: 'critical',
                source: 'billing',
                status: 'unread',
                is_pinned: true
              });
            console.log(`[Asaas Checkout] Notificação crítica inserida para organização ${orgId}`);
          } catch (e: any) {
            console.error('[Asaas Checkout] Erro ao criar notificação de falha no cancelamento:', e.message);
          }
        }

        await supabaseAdmin
          .from('audit_logs')
          .insert({
            organization_id: orgId,
            user_id: user.id,
            action: 'update_subscription',
            entity: 'subscription',
            entity_id: subscription?.id || null,
            metadata: {
              info: logMessage,
              old_plan: 'basic',
              new_plan: 'pro',
              refund_attempted: isWithin7Days,
              refund_success: refundSuccess,
              refund_payment_id: refundPaymentId,
              refund_error: refundError,
              cancel_error: cancelError,
              old_subscription_id: oldSubscriptionIdToCancel,
              new_subscription_id: subscriptionId
            }
          });
      }
    }

    // 7. Atualizar a assinatura no Supabase
    if (supabaseAdmin) {
      const isAlreadyActive = subscription?.status === 'active';
      const isTrialActive = subscription?.status === 'trialing' && subscription?.trial_ends_at && new Date(subscription.trial_ends_at) > new Date();
      const newStatus = isAlreadyActive ? 'active' : (isTrialActive ? 'trialing' : 'unpaid');

      await supabaseAdmin
        .from('subscriptions')
        .update({
          asaas_subscription_id: subscriptionId,
          billing_provider: 'asaas',
          plan,
          billing_cycle: cycle,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', orgId);

      // Sincronizar status da organização
      await supabaseAdmin
        .from('organizations')
        .update({
          subscription_status: isAlreadyActive ? 'active' : (isTrialActive ? 'trial' : 'canceled')
        })
        .eq('id', orgId);
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('[Asaas Checkout Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao iniciar faturamento Asaas.' },
      { status: 500 }
    );
  }
}
