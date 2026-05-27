import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any }) 
  : null;

const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function POST(request: Request) {
  let replaceSubscriptionId = '';
  let refundOldSubscription = '';

  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe não está configurado no servidor. Defina a chave STRIPE_SECRET_KEY.' },
        { status: 400 }
      );
    }

    // Limitar a 10 tentativas de checkout por hora por IP para mitigar spam de sessões
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limiter = rateLimit(ip, 10, 60 * 60 * 1000);
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
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 400 });
    }

    // 1. Validar a sessão do chamador (JWT nos cookies)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar o perfil para obter a organização real do usuário logado
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Falta o campo priceId.' }, { status: 400 });
    }

    // Buscar o nome real da organização para colocar nas metadados da sessão
    const { data: org } = await supabase
      .from('organizations')
      .select('name, stripe_customer_id, subscription_status')
      .eq('id', profile.organization_id)
      .single();

    const orgId = profile.organization_id;
    const orgName = org?.name || 'BoxHub Customer';
    const userEmail = profile.email || user.email;
    const existingCustomerId = org?.stripe_customer_id;

    // Se já possui assinatura ativa, tratamos upgrade/downgrade de plano de forma inteligente
    if (org?.subscription_status === 'active' && existingCustomerId && supabaseAdmin) {
      // 1. Buscar a assinatura ativa na tabela de assinaturas do Supabase
      const { data: subData } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id, plan')
        .eq('company_id', orgId)
        .single();
      
      let stripeSubscriptionId = subData?.stripe_subscription_id;

      // Se não temos o ID no banco, consultamos diretamente no Stripe como fallback
      if (!stripeSubscriptionId) {
        try {
          const activeSubs = await stripe.subscriptions.list({
            customer: existingCustomerId,
            status: 'active',
            limit: 1
          });
          if (activeSubs.data.length > 0) {
            stripeSubscriptionId = activeSubs.data[0].id;
            console.log(`[Stripe Checkout] Assinatura ativa encontrada diretamente no Stripe: ${stripeSubscriptionId}`);
            
            // Sincroniza retroativamente no banco para as próximas consultas
            await supabaseAdmin
              .from('subscriptions')
              .update({ stripe_subscription_id: stripeSubscriptionId })
              .eq('company_id', orgId);
          }
        } catch (stripeListError: any) {
          console.error('[Stripe Checkout] Falha ao listar assinaturas do cliente no Stripe:', stripeListError.message);
        }
      }

      // 2. Se temos o ID de assinatura do Stripe, processamos a mudança
      if (stripeSubscriptionId) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

          // Verificar a data de criação para reembolsar se for dentro de 7 dias
          const createdDate = new Date(stripeSub.created * 1000);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - createdDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isWithin7Days = diffDays <= 7;

          if (isWithin7Days) {
            console.log(`[Stripe Upgrade] Transição dentro do prazo de 7 dias. Agendando reembolso e cancelamento pós-pagamento.`);
            replaceSubscriptionId = stripeSub.id;
            refundOldSubscription = 'true';
          } else {
            console.log(`[Stripe Upgrade] Transição após 7 dias. Executando atualização direta de assinatura.`);
            // Se passou de 7 dias, fazemos a mudança direta via assinatura com cobrança proporcional imediata
            await stripe.subscriptions.update(stripeSub.id, {
              items: [{
                id: stripeSub.items.data[0].id,
                price: priceId,
              }],
              proration_behavior: 'always_invoice', // Emite a fatura com o valor proporcional imediatamente
            });

            return NextResponse.json({ url: null, updated: true });
          }
        } catch (stripeSubError: any) {
          console.error('[Stripe Upgrade] Falha ao processar transição de assinatura no Stripe:', stripeSubError);
          return NextResponse.json({ error: `Erro ao gerenciar assinatura no Stripe: ${stripeSubError.message}` }, { status: 400 });
        }
      }
    }

    let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    appUrl = appUrl.trim();
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const sessionOptions: any = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Stripe Price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/dashboard/configuracoes?canceled=true`,
      subscription_data: {
        metadata: {
          orgId,
        },
      },
      metadata: {
        orgId,
        orgName,
      },
    };

    if (replaceSubscriptionId) {
      sessionOptions.metadata.replaceSubscriptionId = replaceSubscriptionId;
      sessionOptions.subscription_data.metadata.replaceSubscriptionId = replaceSubscriptionId;
    }
    if (refundOldSubscription) {
      sessionOptions.metadata.refundOldSubscription = refundOldSubscription;
      sessionOptions.subscription_data.metadata.refundOldSubscription = refundOldSubscription;
    }

    if (existingCustomerId) {
      sessionOptions.customer = existingCustomerId;
    } else {
      sessionOptions.customer_email = userEmail;
    }

    // Criar a sessão de checkout do Stripe com propagação de metadados
    const session = await stripe.checkout.sessions.create(sessionOptions);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Erro Stripe Checkout session:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao iniciar sessão de checkout.' },
      { status: 500 }
    );
  }
}
