import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    // 1. Validar a chave CRON_SECRET no cabeçalho Authorization
    const authHeader = request.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Weekly Summary Cron] CRON_SECRET não está configurado.');
      return NextResponse.json({ error: 'CRON_SECRET não configurado no servidor.' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[Weekly Summary Cron] Tentativa de execução não autorizada.');
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[Weekly Summary Cron] Supabase Admin Client não inicializado.');
      return NextResponse.json({ error: 'Servidor indisponível.' }, { status: 500 });
    }

    console.log('[Weekly Summary Cron] Iniciando processamento do resumo semanal para todas as organizações...');

    // 2. Buscar todas as organizações ativas ou trialing
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, subscription_status')
      .in('subscription_status', ['active', 'trial']);

    if (orgsError || !orgs) {
      console.error('[Weekly Summary Cron] Erro ao buscar organizações:', orgsError);
      return NextResponse.json({ error: 'Erro ao buscar organizações.' }, { status: 500 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStart = sevenDaysAgo.toISOString().split('T')[0];

    let processedCount = 0;

    for (const org of orgs) {
      try {
        const orgId = org.id;

        // Verificar assinatura para garantir que não está expirada
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('status, trial_ends_at')
          .eq('company_id', orgId)
          .maybeSingle();

        if (sub) {
          const now = new Date();
          const isTrialExpired = sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) < now;
          const isInactive = ['canceled', 'unpaid'].includes(sub.status);
          if (isTrialExpired || isInactive) {
            console.log(`[Weekly Summary Cron] Pulando box ${org.name} pois a assinatura está expirada ou suspensa.`);
            continue;
          }
        }

        // Criar chave lógica no metadata: weekly_summary:${orgId}:${weekStart}
        const summaryKey = `weekly_summary:${orgId}:${weekStart}`;

        // Verificar se já existe uma notificação com esta chave lógica
        const { data: existingSummary } = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('organization_id', orgId)
          .eq('metadata->weekly_summary_key', summaryKey)
          .limit(1)
          .maybeSingle();

        if (existingSummary) {
          console.log(`[Weekly Summary Cron] Resumo semanal já gerado para box ${org.name} com chave: ${summaryKey}`);
          continue;
        }

        // 3. Buscar vendas da organização nos últimos 7 dias
        const { data: sales, error: salesError } = await supabaseAdmin
          .from('sales')
          .select('id, client_id, total_amount, payment_method, created_at')
          .eq('organization_id', orgId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .neq('is_canceled', true);

        if (salesError) {
          console.error(`[Weekly Summary Cron] Erro ao buscar vendas para org ${org.name}:`, salesError);
          continue;
        }

        let title = '📊 Resumo Semanal do Box';
        let message = '';
        let description = '';
        let priority: 'low' | 'medium' | 'high' | 'critical' | 'positive' = 'medium';

        if (!sales || sales.length === 0) {
          // Caso a organização não tenha registrado nenhuma venda nos últimos 7 dias
          message = 'Nenhuma venda registrada na última semana.';
          description = 'Seu box não teve movimentações de vendas registradas entre os dias ' + 
            sevenDaysAgo.toLocaleDateString('pt-BR') + ' e ' + new Date().toLocaleDateString('pt-BR') + 
            '. Que tal registrar suas primeiras vendas e acompanhar a evolução do seu negócio?';
          priority = 'low';
        } else {
          // Realizar cálculos
          const salesCount = sales.length;
          const totalAmount = sales.reduce((acc, s) => acc + Number(s.total_amount), 0);

          // Agrupamento por forma de pagamento
          let pixTotal = 0;
          let cashTotal = 0;
          let fiadoTotal = 0;

          sales.forEach((s) => {
            const val = Number(s.total_amount);
            if (s.payment_method === 'pix') pixTotal += val;
            else if (s.payment_method === 'dinheiro') cashTotal += val;
            else if (s.payment_method === 'fiado') fiadoTotal += val;
          });

          // Determinar Cliente da Semana (quem gastou mais)
          const clientSpending: Record<string, number> = {};
          sales.forEach((s) => {
            if (s.client_id) {
              clientSpending[s.client_id] = (clientSpending[s.client_id] || 0) + Number(s.total_amount);
            }
          });

          let topClientId = '';
          let maxSpent = 0;
          for (const [cid, amt] of Object.entries(clientSpending)) {
            if (amt > maxSpent) {
              maxSpent = amt;
              topClientId = cid;
            }
          }

          let topClientName = '';
          if (topClientId) {
            const { data: clientObj } = await supabaseAdmin
              .from('clients')
              .select('name')
              .eq('id', topClientId)
              .single();
            topClientName = clientObj?.name || '';
          }

          // Determinar Produto Destaque (mais caixas vendidas)
          const saleIds = sales.map((s) => s.id);
          const { data: saleItems } = await supabaseAdmin
            .from('sale_items')
            .select('product_id, quantity')
            .in('sale_id', saleIds);

          const productVolume: Record<string, number> = {};
          (saleItems || []).forEach((item) => {
            if (item.product_id) {
              productVolume[item.product_id] = (productVolume[item.product_id] || 0) + Number(item.quantity);
            }
          });

          let topProductId = '';
          let maxQty = 0;
          for (const [pid, qty] of Object.entries(productVolume)) {
            if (qty > maxQty) {
              maxQty = qty;
              topProductId = pid;
            }
          }

          let topProductName = '';
          if (topProductId) {
            const { data: productObj } = await supabaseAdmin
              .from('products')
              .select('name')
              .eq('id', topProductId)
              .single();
            topProductName = productObj?.name || '';
          }

          // Montar o conteúdo do resumo semanal
          message = `Balanço Geral: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} faturados em ${salesCount} vendas.`;
          priority = 'positive';

          description = `Confira os indicadores de desempenho do seu box entre os dias ${sevenDaysAgo.toLocaleDateString('pt-BR')} e ${new Date().toLocaleDateString('pt-BR')}:\n\n` +
            `• Faturamento Total: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            `• Vendas Registradas: ${salesCount}\n` +
            `• Divisão por Meios de Pagamento:\n` +
            `  - PIX: R$ ${pixTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            `  - Dinheiro: R$ ${cashTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
            `  - Fiado: R$ ${fiadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

          if (topClientName) {
            description += `• Cliente da Semana: ${topClientName} (investiu R$ ${maxSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n`;
          }

          if (topProductName) {
            description += `• Produto Mais Vendido: ${topProductName} (${maxQty} caixas comercializadas)\n`;
          }

          description += '\nÓtimo trabalho! Continue gerindo seu estoque e vendas para alavancar seus lucros.';
        }

        // 4. Inserir a notificação semanal
        await supabaseAdmin
          .from('notifications')
          .insert({
            organization_id: orgId,
            user_id: null, // Para toda a organização
            title,
            message,
            description,
            type: 'system', // Tipo system
            priority,
            source: 'cron', // Origem cron
            status: 'unread',
            is_pinned: false,
            action_url: '/dashboard',
            action_label: 'Ir para Painel',
            metadata: {
              cron_run: new Date().toISOString(),
              sales_count: sales?.length || 0,
              weekly_summary_key: summaryKey
            }
          });

        processedCount++;
      } catch (orgErr) {
        console.error(`[Weekly Summary Cron] Erro ao processar resumo da organização ${org.name} (ID: ${org.id}):`, orgErr);
      }
    }

    console.log(`[Weekly Summary Cron] Fim do processamento. Organizações processadas: ${processedCount}`);
    return NextResponse.json({ success: true, processedCount });
  } catch (err: any) {
    console.error('[Weekly Summary Cron Error]:', err);
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
export async function GET(request: Request) {
  // Permitir GET também para facilitar acionamento manual ou testes locais
  return POST(request);
}
