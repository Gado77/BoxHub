import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  let eventId = '';
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[Asaas Webhook] Supabase Admin Service Role não configurada.');
      return NextResponse.json({ error: 'Servidor indisponível.' }, { status: 500 });
    }
    // 1. Validar o token de segurança do webhook (aceita asaas-access-key ou asaas-access-token)
    const webhookSecret = process.env.ASAAS_WEBHOOK_SECRET;
    const receivedToken = request.headers.get('asaas-access-key') || request.headers.get('asaas-access-token');

    if (webhookSecret && receivedToken !== webhookSecret) {
      console.warn('[Asaas Webhook] Tentativa de acesso não autorizada com token incorreto.');
      return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const event = body.event;

    if (!event) {
      return NextResponse.json({ error: 'Payload incompleto. Evento não especificado.' }, { status: 400 });
    }

    // 2. Gerar chave de idempotência com fallback
    const payment = body.payment;
    const subscriptionEntity = body.subscription;

    eventId = body.id || 
              (payment?.id && event ? `${payment.id}:${event}` : null) || 
              (subscriptionEntity?.id && event ? `${subscriptionEntity.id}:${event}` : null) || 
              `evt_fallback_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[Asaas Webhook] Novo evento recebido: ${event} (ID Gerado/Recebido: ${eventId})`);

    // 3. Verificar estado de idempotência no banco de dados
    const { data: existingEvent, error: selectError } = await supabaseAdmin
      .from('webhook_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (selectError) {
      console.error('[Asaas Webhook] Erro ao buscar evento de idempotência:', selectError);
      return NextResponse.json({ error: 'Erro interno de banco.' }, { status: 500 });
    }

    if (existingEvent) {
      if (existingEvent.status === 'processed' || existingEvent.status === 'processing') {
        console.log(`[Asaas Webhook] Evento já processado ou em processamento (status: ${existingEvent.status}): ${eventId}`);
        return NextResponse.json({ received: true, status: existingEvent.status, duplicate: true }, { status: 200 });
      }

      // Se o status for 'failed', permitimos reprocessar atualizando o status para 'processing'
      if (existingEvent.status === 'failed') {
        console.log(`[Asaas Webhook] Evento falhou anteriormente. Reiniciando processamento para: ${eventId}`);
        const { error: updateError } = await supabaseAdmin
          .from('webhook_events')
          .update({ status: 'processing', processed_at: new Date().toISOString() })
          .eq('id', eventId);

        if (updateError) {
          console.error('[Asaas Webhook] Erro ao redefinir status para processing:', updateError);
          return NextResponse.json({ error: 'Erro de concorrência.' }, { status: 500 });
        }
      }
    } else {
      // Inserir inicialmente como 'processing'
      const { error: insertError } = await supabaseAdmin
        .from('webhook_events')
        .insert({
          id: eventId,
          provider: 'asaas',
          status: 'processing',
          processed_at: new Date().toISOString()
        });

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`[Asaas Webhook] Concorrência detectada para evento: ${eventId}`);
          return NextResponse.json({ received: true, status: 'processing_concurrent', duplicate: true }, { status: 200 });
        }
        console.error('[Asaas Webhook] Erro ao registrar evento de idempotência:', insertError);
        return NextResponse.json({ error: 'Erro ao registrar evento.' }, { status: 500 });
      }
    }

    // 4. Extrair referências de Assinatura/Cliente
    let asaasSubscriptionId = '';
    let asaasCustomerId = '';

    if (payment) {
      asaasSubscriptionId = payment.subscription;
      asaasCustomerId = payment.customer;
    } else if (subscriptionEntity) {
      asaasSubscriptionId = subscriptionEntity.id;
      asaasCustomerId = subscriptionEntity.customer;
    }

    if (!asaasSubscriptionId && !asaasCustomerId) {
      console.log('[Asaas Webhook] Evento não associado a uma assinatura ou cliente. Finalizando com sucesso.');
      await supabaseAdmin
        .from('webhook_events')
        .update({ status: 'processed' })
        .eq('id', eventId);
      return NextResponse.json({ received: true });
    }

    // 5. Buscar a assinatura correspondente no Supabase
    let query = supabaseAdmin.from('subscriptions').select('*');
    if (asaasSubscriptionId) {
      query = query.eq('asaas_subscription_id', asaasSubscriptionId);
    } else {
      query = query.eq('asaas_customer_id', asaasCustomerId);
    }
    
    const { data: subscription, error: findError } = await query.maybeSingle();

    if (findError || !subscription) {
      console.warn(`[Asaas Webhook] Nenhuma assinatura correspondente encontrada no banco para sub: ${asaasSubscriptionId}, cust: ${asaasCustomerId}`);
      // Marca como processado com sucesso técnico (pois não há ação possível localmente)
      await supabaseAdmin
        .from('webhook_events')
        .update({ status: 'processed' })
        .eq('id', eventId);
      return NextResponse.json({ received: true, warning: 'Subscription not found in local DB' });
    }

    const orgId = subscription.company_id;

    // 6. Mapear o evento Asaas para status internos
    let newStatus = subscription.status;
    let updateFields: any = { updated_at: new Date().toISOString() };

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        newStatus = 'active';
        // Calcula o novo final de período baseado no ciclo
        const cycle = subscription.billing_cycle || 'monthly';
        const daysToAdd = cycle === 'annual' ? 365 : 30;
        const nextPeriodEnd = new Date();
        nextPeriodEnd.setDate(nextPeriodEnd.getDate() + daysToAdd);
        updateFields.current_period_end = nextPeriodEnd.toISOString();
        updateFields.status = newStatus;
        break;

      case 'PAYMENT_OVERDUE':
        newStatus = 'past_due';
        updateFields.status = newStatus;
        break;

      case 'PAYMENT_DELETED':
      case 'SUBSCRIPTION_DELETED':
        newStatus = 'canceled';
        updateFields.status = newStatus;
        break;

      case 'PAYMENT_DUNNING_RECEIVED':
        newStatus = 'unpaid';
        updateFields.status = newStatus;
        break;

      default:
        console.log(`[Asaas Webhook] Evento ${event} não causará transição de status.`);
        break;
    }

    // 7. Persistir as atualizações no banco de dados se houver alteração de status
    if (updateFields.status) {
      console.log(`[Asaas Webhook] Atualizando assinatura ${subscription.id} para status: ${newStatus}`);
      
      const { error: subUpdateError } = await supabaseAdmin
        .from('subscriptions')
        .update(updateFields)
        .eq('id', subscription.id);

      if (subUpdateError) {
        throw subUpdateError;
      }

      // Mapear status de assinatura para status de organização
      let orgStatus: 'trial' | 'active' | 'past_due' | 'canceled' = 'trial';
      if (newStatus === 'active') orgStatus = 'active';
      else if (newStatus === 'trialing') orgStatus = 'trial';
      else if (newStatus === 'past_due') orgStatus = 'past_due';
      else if (['canceled', 'unpaid'].includes(newStatus)) orgStatus = 'canceled';

      const { error: orgUpdateError } = await supabaseAdmin
        .from('organizations')
        .update({ subscription_status: orgStatus })
        .eq('id', orgId);

      if (orgUpdateError) {
        console.error('[Asaas Webhook] Erro ao atualizar status da organização:', orgUpdateError);
      }
    }

    // 8. Marcar evento como processado definitivamente com sucesso
    const { error: markProcessedError } = await supabaseAdmin
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', eventId);

    if (markProcessedError) {
      console.error('[Asaas Webhook] Erro ao marcar evento como processed:', markProcessedError);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Asaas Webhook Route Error]:', err);
    // Em caso de falha no fluxo, marcar evento como 'failed' para permitir reprocessamento futuro
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin && eventId) {
      const { error: updateFailedError } = await supabaseAdmin
        .from('webhook_events')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', eventId);
      if (updateFailedError) {
        console.error('[Asaas Webhook] Falha ao atualizar status para failed:', updateFailedError);
      }
    }
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
