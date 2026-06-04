import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { testNotificationSchema } from '@/lib/schemas';

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
    const isProd = process.env.NODE_ENV === 'production';
    
    // 1. Inicializar o cliente do servidor autenticado (baseado em cookies) para validar a sessão
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    // 2. Validar a sessão do chamador
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser();
    if (authError || !caller) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 3. Buscar o perfil do chamador para verificar a organização e a role
    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', caller.id)
      .single();

    if (callerProfileError || !callerProfile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    // 4. Bloquear em produção se não for superadmin
    if (isProd && callerProfile.role !== 'superadmin') {
      return NextResponse.json({ 
        error: 'Apenas superadministradores globais podem injetar notificações de teste em produção.' 
      }, { status: 403 });
    }

    // 5. Validar corpo da requisição com Zod
    const body = await request.json();
    const result = testNotificationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Dados de notificação inválidos.', details: result.error.format() }, { status: 400 });
    }

    const notifData = result.data;

    // 6. Inserir a notificação usando o cliente admin (para contornar a restrição de RLS que bloqueia inserts do frontend)
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client não configurado no servidor.' }, { status: 500 });
    }

    const { data: newNotification, error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert({
        organization_id: callerProfile.organization_id,
        user_id: notifData.user_id || null, // nulo = toda a organização
        title: notifData.title,
        message: notifData.message,
        description: notifData.description || null,
        type: notifData.type,
        priority: notifData.priority,
        source: notifData.source,
        status: 'unread',
        is_pinned: notifData.is_pinned,
        action_url: notifData.action_url || null,
        action_label: notifData.action_label || null,
        metadata: notifData.action_url ? { click_action: notifData.action_url } : {}
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: `Erro ao injetar notificação: ${insertError.message}` }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Notificação de teste gerada com sucesso.',
      notification: newNotification 
    });

  } catch (err: any) {
    console.error('Erro na API POST /api/notifications/test:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
