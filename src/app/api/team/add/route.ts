import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { getOrgFeatures } from '@/lib/features';
import { teamInviteSchema } from '@/lib/schemas';


// Inicializar Supabase Admin usando a chave de serviço secreta para criar o usuário e perfil
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client não configurado no servidor.' }, { status: 400 });
    }

    // Limitar criação de membros a 20 convites por hora por IP para evitar spam
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limiter = await rateLimit(ip, 20, 60 * 60 * 1000);
    if (!limiter.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Limite de convites excedido. Tente novamente mais tarde.' }),
        { 
          status: 429, 
          headers: { 
            'Retry-After': Math.ceil((limiter.reset - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json'
          } 
        }
      );
    }

    // Inicializar o cliente do servidor autenticado (baseado em cookies) para validar a sessão
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 400 });
    }

    // 1. Validar a sessão do chamador (JWT nos cookies)
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser();
    if (authError || !caller) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar o perfil do chamador para obter o cargo (role) e organização
    const { data: callerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'Perfil do administrador não encontrado.' }, { status: 404 });
    }

    // Obter dados da requisição e validar com Zod
    const body = await request.json();
    const validation = teamInviteSchema.safeParse(body);
    
    if (!validation.success) {
      const errorMsg = validation.error.issues.map(e => e.message).join(' ');
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    
    const { email, name, role, organization_id } = validation.data;

    // 4. Validar se o chamador pertence à mesma organização do novo membro
    const isCallerSuperAdmin = callerProfile.role === 'superadmin';
    if (!isCallerSuperAdmin && callerProfile.organization_id !== organization_id) {
      return NextResponse.json({ 
        error: 'Não autorizado. Você não pode gerenciar membros de outra organização.' 
      }, { status: 403 });
    }

    // 5. Validar se o chamador possui cargo adequado (apenas admin ou superadmin podem convidar)
    if (callerProfile.role !== 'admin' && !isCallerSuperAdmin) {
      return NextResponse.json({ 
        error: 'Apenas administradores podem gerenciar e convidar membros para a equipe.' 
      }, { status: 403 });
    }

    // Impede usuários não superadmin de criar perfis com cargo de superadmin
    if (role === 'superadmin' && !isCallerSuperAdmin) {
      return NextResponse.json({ 
        error: 'Apenas superadmins globais podem criar novos superadmins.' 
      }, { status: 403 });
    }

    // 6. Validar limite de usuários do plano (SaaS Billing Enforcement)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', organization_id)
      .single();

    const { count: currentMembersCount, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id);

    if (countError) {
      return NextResponse.json({ error: 'Erro ao validar limites de membros da equipe.' }, { status: 500 });
    }

    const features = getOrgFeatures(subscription);
    if (!features.canInviteUsers) {
      return NextResponse.json({ 
        error: 'A sua assinatura atual está suspensa ou expirada. Regularize seu faturamento para convidar membros.' 
      }, { status: 403 });
    }

    if (currentMembersCount !== null && currentMembersCount >= features.maxUsers) {
      return NextResponse.json({ 
        error: `Limite de usuários atingido para o seu plano (${features.maxUsers} membros). Faça o upgrade do seu plano para adicionar mais membros.` 
      }, { status: 403 });
    }


    // Limpar usuário órfão se existir no Auth mas não no profiles
    try {
      const { data: { users: authUsers }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

      if (!listUsersError && authUsers) {
        const existingAuthUser = authUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (existingAuthUser) {
          // Verificar se esse usuário tem perfil correspondente no banco
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', existingAuthUser.id)
            .maybeSingle();

          if (!existingProfile) {
            // Usuário existe no Auth mas NÃO tem perfil (estado órfão)
            // Deletamos para poder criar um convite novo limpo
            await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
          } else {
            // Usuário já está ativo e possui perfil
            return NextResponse.json({ 
              error: 'Este e-mail já está cadastrado em uma conta ativa.' 
            }, { status: 400 });
          }
        }
      }
    } catch (cleanErr) {
      console.warn('Erro ao limpar usuário órfão antes do convite:', cleanErr);
    }

    const requestUrl = new URL(request.url);
    const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

    // Criar o usuário no Supabase Auth por meio do convite
    const { data: authData, error: authErrorInvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/welcome`,
      data: {
        full_name: name
      }
    });

    if (authErrorInvite) {
      return NextResponse.json({ error: authErrorInvite.message }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json({ error: 'Falha ao criar convite.' }, { status: 400 });
    }

    // Inserir perfil na tabela pública profiles
    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        organization_id,
        name,
        role,
        email
      });

    if (insertProfileError) {
      // Reverter criação do usuário no auth em caso de erro no profile
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: insertProfileError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      invitedViaEmail: true,
      member: {
        id: authData.user.id,
        organization_id,
        name,
        role,
        email
      }
    });

  } catch (err: any) {
    console.error('Erro na API de criação de membro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
