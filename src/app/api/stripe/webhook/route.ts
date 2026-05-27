import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any }) 
  : null;

// Inicializa cliente administrativo para bypassar as regras RLS
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Função utilitária para sincronizar a assinatura do Stripe no banco de dados Supabase.
 * Usa um fluxo idempotente baseado em .upsert().
 */
async function syncSubscription(stripeSubscriptionId: string) {
  if (!stripe || !supabaseAdmin) return;

  const subscription = (await stripe.subscriptions.retrieve(stripeSubscriptionId)) as any;
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;

  // 1. Mapear o priceId obtido do Stripe para os planos do BoxHub
  let plan: 'basic' | 'pro' | 'enterprise' = 'basic';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) {
    plan = 'pro';
  } else if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) {
    plan = 'basic';
  }

  // 2. Identificar a organização (orgId / company_id)
  let orgId = subscription.metadata?.orgId;
  
  if (!orgId) {
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('company_id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    orgId = existingSub?.company_id;
  }

  if (!orgId) {
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();
    
    orgId = existingOrg?.id;
  }

  if (!orgId) {
    console.error(`[Webhook Stripe] Organização não encontrada para o Stripe Customer: ${customerId}`);
    return;
  }

  // 3. Sincronizar na tabela subscriptions
  const subscriptionData = {
    company_id: orgId,
    stripe_customer_id: customerId,
    stripe_subscription_id: stripeSubscriptionId,
    stripe_price_id: priceId,
    plan,
    status: subscription.status, // trialing, active, past_due, canceled, unpaid, incomplete
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    trial_ends_at: subscription.trial_end 
      ? new Date(subscription.trial_end * 1000).toISOString() 
      : null,
    updated_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'company_id' });

  if (upsertError) throw upsertError;

  // 4. Manter a compatibilidade com a tabela legacy organizations
  let legacyStatus: 'trial' | 'active' | 'past_due' | 'canceled' = 'trial';
  if (subscription.status === 'active') legacyStatus = 'active';
  if (subscription.status === 'trialing') legacyStatus = 'trial';
  if (subscription.status === 'past_due') legacyStatus = 'past_due';
  if (['canceled', 'unpaid'].includes(subscription.status)) legacyStatus = 'canceled';

  await supabaseAdmin
    .from('organizations')
    .update({
      stripe_customer_id: customerId,
      subscription_status: legacyStatus,
      subscription_price_id: priceId
    })
    .eq('id', orgId);

  console.log(`[Webhook Stripe] Assinatura ${stripeSubscriptionId} sincronizada com sucesso para a Org: ${orgId}.`);
}

export async function POST(request: Request) {
  if (!stripe || !supabaseAdmin) {
    return NextResponse.json({ error: 'Servidor com integrações desconfiguradas.' }, { status: 400 });
  }

  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Assinatura Stripe em falta.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook Stripe] Falha na validação criptográfica: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          await syncSubscription(session.subscription as string);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription.id);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          // Atualiza a assinatura via Stripe ID
          await syncSubscription(invoice.subscription as string);
        }
        break;
      }
      default:
        console.log(`[Webhook Stripe] Evento ignorado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook Stripe] Erro crítico ao processar o evento:', err);
    return NextResponse.json({ error: 'Erro interno ao processar webhook.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
