import { NextResponse } from 'next/server';
import Stripe from 'stripe';

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

    const { priceId, orgId, orgName, userEmail } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Falta o campo priceId.' }, { status: 400 });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Stripe Price ID
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/configuracoes?canceled=true`,
      metadata: {
        orgId,
        orgName,
      },
      customer_email: userEmail,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Erro Stripe Checkout session:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao iniciar sessão de checkout.' },
      { status: 500 }
    );
  }
}
