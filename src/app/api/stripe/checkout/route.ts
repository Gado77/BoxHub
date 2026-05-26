import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';

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
      .select('name')
      .eq('id', profile.organization_id)
      .single();

    const orgId = profile.organization_id;
    const orgName = org?.name || 'BoxHub Customer';
    const userEmail = profile.email || user.email;

    // Criar a sessão de checkout do Stripe com propagação de metadados
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
      subscription_data: {
        metadata: {
          orgId,
        },
      },
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
