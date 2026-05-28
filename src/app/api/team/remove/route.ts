import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';

// Inicializar Supabase Admin usando a chave de serviço secreta para gerenciar auth.users
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
      return NextResponse.json({ error: 'Supabase admin client não configurado no servidor.' }, { status: 500 });
    }

    // Inicializar o cliente do servidor autenticado (baseado em cookies) para validar a sessão
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    // 1. Validar a sessão do chamador
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser();
    if (authError || !caller) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar o perfil do chamador
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', caller.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Perfil do administrador não encontrado.' }, { status: 404 });
    }

    // 3. Validar se o chamador possui cargo adequado (apenas admin ou superadmin)
    const isCallerSuperAdmin = callerProfile.role === 'superadmin';
    if (callerProfile.role !== 'admin' && !isCallerSuperAdmin) {
      return NextResponse.json({ 
        error: 'Apenas administradores podem gerenciar membros da equipe.' 
      }, { status: 403 });
    }

    // Obter dados da requisição
    const { memberId } = await request.json();
    if (!memberId) {
      return NextResponse.json({ error: 'ID do membro não fornecido.' }, { status: 400 });
    }

    // 4. Buscar o perfil do membro a ser removido
    const { data: memberProfile, error: memberProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberProfileError || !memberProfile) {
      return NextResponse.json({ error: 'Membro não encontrado ou já removido.' }, { status: 404 });
    }

    // 5. Validar se o chamador pertence à mesma organização do membro (exceto superadmin)
    if (!isCallerSuperAdmin && callerProfile.organization_id !== memberProfile.organization_id) {
      return NextResponse.json({ 
        error: 'Não autorizado. Você não pode gerenciar membros de outra organização.' 
      }, { status: 403 });
    }

    // 6. Buscar o dono principal (perfil mais antigo criado na organização)
    const { data: oldestProfile, error: oldestError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('organization_id', memberProfile.organization_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (oldestError || !oldestProfile) {
      return NextResponse.json({ error: 'Erro ao identificar o dono principal do Box.' }, { status: 500 });
    }

    const isSelfDeletion = caller.id === memberId;

    // A. Não é possível remover o dono principal
    if (memberId === oldestProfile.id) {
      return NextResponse.json({ 
        error: 'Não é possível remover o dono principal da firma/box.' 
      }, { status: 403 });
    }

    // B. Se o membro a ser removido for um Admin (e não for auto-exclusão)
    if (memberProfile.role === 'admin' && !isSelfDeletion) {
      // Apenas o dono principal (oldestProfile) ou um superadmin global pode remover outro admin
      if (caller.id !== oldestProfile.id && !isCallerSuperAdmin) {
        return NextResponse.json({ 
          error: 'Apenas o dono principal do Box pode remover outros administradores.' 
        }, { status: 403 });
      }
    }

    // 7. Deletar o usuário no Supabase Auth por meio do Admin API
    // Isso vai disparar o delete cascade na tabela public.profiles automaticamente!
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(memberId);
    if (deleteAuthError) {
      console.error('Erro ao deletar usuário do Auth:', deleteAuthError);
      return NextResponse.json({ error: `Erro ao remover usuário do sistema de autenticação: ${deleteAuthError.message}` }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Membro removido com sucesso.'
    });

  } catch (err: any) {
    console.error('Erro na API de remoção de membro:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
