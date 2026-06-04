import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { AsaasBillingProvider } from '@/lib/billing';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
      .select('name, asaas_customer_id, subscription_status')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 });
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
