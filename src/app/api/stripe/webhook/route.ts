import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any }) 
  : null;

// Initialize Supabase with Service Role to bypass RLS for webhook updates
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

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
    console.error(`Falha ao verificar assinatura do Webhook: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Retrieve checkout session or metadata mapping to find orgId
        // Alternately, check metadata on the subscription object
        const orgId = subscription.metadata?.orgId;
        const priceId = subscription.items.data[0]?.price.id;

        // Stripe status: trialing, active, past_due, canceled
        let status: 'trial' | 'active' | 'past_due' | 'canceled' = 'trial';
        if (subscription.status === 'active') status = 'active';
        if (subscription.status === 'past_due') status = 'past_due';
        if (subscription.status === 'canceled' || subscription.status === 'unpaid') status = 'canceled';

        if (orgId) {
          await supabaseAdmin
            .from('organizations')
            .update({
              stripe_customer_id: customerId,
              subscription_status: status,
              subscription_price_id: priceId,
            })
            .eq('id', orgId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;

        if (orgId) {
          await supabaseAdmin
            .from('organizations')
            .update({
              subscription_status: 'canceled',
            })
            .eq('id', orgId);
        }
        break;
      }
      default:
        console.log(`Evento de webhook ignorado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Erro ao processar Stripe Webhook:', err);
    return NextResponse.json({ error: 'Erro interno ao processar webhook.' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
