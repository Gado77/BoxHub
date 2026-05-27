import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServerClient } from '@/lib/supabase-server';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any }) 
  : null;

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe não está configurado no servidor. Defina a chave STRIPE_SECRET_KEY.' },
        { status: 400 }
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

    // 3. Buscar a assinatura para obter o stripe_customer_id
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', profile.organization_id)
      .single();

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', profile.organization_id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // Se o cliente não tem stripe_customer_id cadastrado na tabela de assinatura, criamos na hora no Stripe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        name: org?.name || 'Cliente BoxHub',
        metadata: {
          orgId: profile.organization_id
        }
      });
      customerId = customer.id;

      // Sincroniza o stripe_customer_id recém-criado na tabela de assinaturas
      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('company_id', profile.organization_id);
      } else {
        // Se por algum motivo o registro de assinatura não existir, criamos um no plano basic trial
        await supabase
          .from('subscriptions')
          .insert({
            company_id: profile.organization_id,
            stripe_customer_id: customerId,
            plan: 'basic',
            status: 'trialing',
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 4. Criar a sessão do portal de faturamento (Billing Portal) do Stripe
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/configuracoes`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Erro ao gerar Stripe Customer Portal:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao iniciar o portal de faturamento.' },
      { status: 500 }
    );
  }
}
