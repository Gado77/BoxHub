import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não configurado.' }, { status: 500 });
    }

    // 1. Validar a sessão do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório.' }, { status: 400 });
    }

    // 2. Buscar o perfil do usuário autenticado para verificar multi-inquilinato (multi-tenant)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    // 3. Buscar informações do cliente
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // 4. Validar que o cliente pertence à organização do usuário (segurança multi-tenant)
    if (client.organization_id !== profile.organization_id && profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acesso negado. Este cliente pertence a outra organização.' },
        { status: 403 }
      );
    }

    const orgId = client.organization_id;
    const limit = Number(client.fiado_limit);

    // 5. Calcular saldo devedor atual do fiado
    // Regra: todas as vendas fiado não canceladas do cliente
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('total_amount')
      .eq('client_id', clientId)
      .eq('payment_method', 'fiado')
      .neq('is_canceled', true);

    if (salesError) {
      throw salesError;
    }

    // Menos todos os fiado_payments do cliente
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('fiado_payments')
      .select('amount')
      .eq('client_id', clientId);

    if (paymentsError) {
      throw paymentsError;
    }

    const totalDebt = (sales || []).reduce((acc, curr) => acc + Number(curr.total_amount), 0);
    const totalPaid = (payments || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const balance = Math.max(0, totalDebt - totalPaid);

    // 6. Evitar divisão por zero se fiado_limit for <= 0
    if (limit <= 0) {
      return NextResponse.json({ 
        alerted: false, 
        balance, 
        limit, 
        percentage: 0, 
        reason: 'limit_is_zero_or_negative' 
      });
    }

    const ratio = balance / limit;
    console.log(`[Fiado Alert] Cliente: ${client.name}. Limite: ${limit}. Saldo: ${balance}. Proporção: ${(ratio * 100).toFixed(1)}%`);

    let alerted = false;

    // 7. Se o saldo atingir 90% do limite, envia alerta
    if (ratio >= 0.9) {
      // Evitar spam: verifica se já existe uma notificação não lida do tipo 'fiado' para este cliente nas últimas 24 horas
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Usando PostgREST JSON operator metadata->client_id para consultar o valor de forma compatível
      const { data: existingAlert } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('organization_id', orgId)
        .eq('type', 'fiado')
        .eq('status', 'unread')
        .eq('metadata->client_id', clientId)
        .gt('created_at', oneDayAgo.toISOString())
        .limit(1)
        .maybeSingle();

      if (!existingAlert) {
        console.log(`[Fiado Alert] Disparando notificação de 90% do limite de fiado para o cliente ${client.name}`);
        const { error: insertError } = await supabaseAdmin
          .from('notifications')
          .insert({
            organization_id: orgId,
            user_id: null, // Visível para toda a organização (admin e vendedores)
            title: '⚠️ Limite de fiado atingido',
            message: `O cliente ${client.name} atingiu ${(ratio * 100).toFixed(0)}% do seu limite de fiado disponível.`,
            description: `${client.name} possui um débito em aberto de R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de um limite de R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
            type: 'fiado',
            priority: 'high',
            source: 'system',
            status: 'unread',
            is_pinned: false,
            action_url: '/dashboard/fiado',
            action_label: 'Ver Gestão de Fiado',
            metadata: { client_id: clientId, current_balance: balance, limit }
          });

        if (insertError) {
          console.error('[Fiado Alert] Erro ao inserir notificação no banco:', insertError);
        } else {
          alerted = true;
        }
      } else {
        console.log(`[Fiado Alert] Alerta recente já existe para o cliente ${client.name}. Ignorando disparo.`);
      }
    }

    return NextResponse.json({ alerted, balance, limit, percentage: ratio * 100 });
  } catch (err: any) {
    console.error('[Fiado Alert Error]:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
