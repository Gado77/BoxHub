import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { updateNotificationStatusSchema } from '@/lib/schemas';

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    // 1. Validar a sessão do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar o perfil do usuário para verificar role e organization_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    // 3. Montar query base respeitando a organização
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('organization_id', profile.organization_id);

    // 4. Se for vendedor, filtrar apenas notificações gerais (user_id nulo) ou direcionadas a ele
    if (profile.role === 'vendedor') {
      query = query.or(`user_id.is.null,user_id.eq.${user.id}`);
    }

    // 5. Ordenar por fixado (pinned) primeiro e depois por data de criação descrescente
    const { data: notifications, error } = await query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: `Erro ao buscar notificações: ${error.message}` }, { status: 400 });
    }

    return NextResponse.json({ notifications });
  } catch (err: any) {
    console.error('Erro na API GET /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    // 1. Validar a sessão
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar o perfil para verificar a organização e a role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    // 3. Validar corpo da requisição com Zod
    const body = await request.json();
    const result = updateNotificationStatusSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos.', details: result.error.format() }, { status: 400 });
    }

    const { id, status } = result.data;
    const readAt = status === 'read' ? new Date().toISOString() : null;

    if (id) {
      // 4a. Marcar notificação individual como lida
      // Primeiro verificar se a notificação existe e o usuário tem acesso
      const { data: notif, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();

      if (notifError || !notif) {
        return NextResponse.json({ error: 'Notificação não encontrada.' }, { status: 404 });
      }

      // Validar acesso (mesma organização e, se vendedor, deve ser geral ou direcionada a ele)
      const hasAccess = 
        notif.organization_id === profile.organization_id &&
        (profile.role === 'admin' || profile.role === 'superadmin' || notif.user_id === null || notif.user_id === user.id);

      if (!hasAccess) {
        return NextResponse.json({ error: 'Você não tem permissão para alterar esta notificação.' }, { status: 403 });
      }

      const { data: updatedNotif, error: updateError } = await supabase
        .from('notifications')
        .update({ 
          status,
          read_at: readAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: `Erro ao atualizar notificação: ${updateError.message}` }, { status: 400 });
      }

      return NextResponse.json({ success: true, notification: updatedNotif });
    } else {
      // 4b. Marcar todas as notificações não lidas como lidas
      let query = supabase
        .from('notifications')
        .update({ 
          status,
          read_at: readAt,
          updated_at: new Date().toISOString()
        })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'unread');

      // Se for vendedor, limita a marcação às que ele tem acesso
      if (profile.role === 'vendedor') {
        query = query.or(`user_id.is.null,user_id.eq.${user.id}`);
      }

      const { error: batchError } = await query;
      if (batchError) {
        return NextResponse.json({ error: `Erro ao marcar todas como lidas: ${batchError.message}` }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (err: any) {
    console.error('Erro na API PATCH /api/notifications:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
