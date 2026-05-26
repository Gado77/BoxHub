import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const isMockMode =
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('your-project-id') ||
    supabaseAnonKey.includes('your-anon-key');

  // Se estiver em modo MOCK, ignora a proteção do middleware
  if (isMockMode) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Atualizar a sessão do Supabase (renovar token se necessário)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');
  const isStripeWebhook = request.nextUrl.pathname === '/api/stripe/webhook';
  const isStripeCheckout = request.nextUrl.pathname === '/api/stripe/checkout';

  // Proteger rotas do dashboard
  if (isDashboardRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Proteger especificamente a página de SuperAdmin
    if (request.nextUrl.pathname.startsWith('/dashboard/superadmin')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
        
      if (!profile || profile.role !== 'superadmin') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }
  }

  // Proteger rotas de API (exceto webhook do Stripe)
  if (isApiRoute && !isStripeWebhook) {
    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'Não autorizado. Sessão inválida ou expirada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica em todos os caminhos exceto arquivos estáticos e imagens
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
