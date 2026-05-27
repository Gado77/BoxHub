import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase-server';
import { rateLimit } from '@/lib/rate-limit';
import { getOrgFeatures } from '@/lib/features';


const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

const anthropic = anthropicKey 
  ? new Anthropic({ apiKey: anthropicKey }) 
  : null;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 400 });
    }

    // Limitar requisições de insights de IA a 10 por minuto por IP (chamada Claude é cara)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limiter = rateLimit(ip, 10, 60 * 1000);
    if (!limiter.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas requisições. Aguarde um minuto.' }),
        { 
          status: 429, 
          headers: { 
            'Retry-After': Math.ceil((limiter.reset - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json'
          } 
        }
      );
    }

    // Obter o usuário autenticado a partir dos cookies de sessão
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // Obter perfil do usuário autenticado para obter organization_id e role de forma segura
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    const orgId = profile.organization_id;
    const role = profile.role;
    const sellerId = profile.id;

    // Verificar se a organização tem permissão de usar os relatórios de IA
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('company_id', orgId)
      .single();

    const features = getOrgFeatures(subscription);
    if (!features.canUseReports) {
      return NextResponse.json({ 
        error: 'Recurso premium. Faça o upgrade para o Plano Pro para obter insights automáticos da IA.' 
      }, { status: 403 });
    }


    // Buscar clientes e vendas filtrados pela organização do usuário autenticado
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', orgId);

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('organization_id', orgId);

    if (clientsError || salesError) {
      console.error('Erro ao buscar dados:', clientsError || salesError);
      return NextResponse.json({ error: 'Erro ao buscar dados no banco.' }, { status: 500 });
    }

    const clientsList = clients || [];
    let salesList = sales || [];

    // Filtrar vendas se o usuário logado for vendedor
    if (role === 'vendedor') {
      salesList = salesList.filter(s => s.seller_id === sellerId);
    }

    // Helper: Calcular métricas dinâmicas para o prompt
    const totalRevenue = salesList.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
    const fiadoSales = salesList.filter(s => s.payment_method === 'fiado' && s.status === 'pendente');
    const totalFiado = fiadoSales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);

    // Se o Anthropic API key não estiver configurado, retornamos insights baseados em regras
    if (!anthropic) {
      const fallbackInsights = [];

      if (clientsList.length === 0) {
        fallbackInsights.push({
          type: 'success',
          text: '✨ **Bem-vindo ao BoxHub!** Cadastre seus primeiros clientes e registre vendas para visualizar análises inteligentes aqui.'
        });
      } else {
        // 1. Calcular maior saldo de fiado
        const clientBalances = clientsList.map(client => {
          const clientSales = salesList.filter(s => s.client_id === client.id && !s.is_canceled);
          const fiadoTotal = clientSales
            .filter(s => s.payment_method === 'fiado' && s.status === 'pendente')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);
          
          return { client, fiadoTotal, sales: clientSales };
        });

        // Filtrar e ordenar pelo saldo do fiado
        const highestFiado = [...clientBalances]
          .filter(cb => cb.fiadoTotal > 0)
          .sort((a, b) => b.fiadoTotal - a.fiadoTotal)[0];

        if (highestFiado) {
          fallbackInsights.push({
            type: 'danger',
            text: `💸 **${highestFiado.client.name}** está com R$ ${highestFiado.fiadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em aberto no fiado. Recomenda-se realizar uma cobrança.`
          });
        }

        // 2. Calcular inatividade (clientes que não compram há algum tempo)
        const now = new Date();
        const clientInactivity = clientBalances
          .map(cb => {
            if (cb.sales.length === 0) return null;
            const lastSaleDate = new Date(Math.max(...cb.sales.map(s => new Date(s.created_at).getTime())));
            const daysDiff = Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24));
            return { client: cb.client, days: daysDiff };
          })
          .filter(Boolean) as { client: any, days: number }[];

        const mostInactive = clientInactivity
          .filter(ci => ci.days > 5) // mais de 5 dias inativo
          .sort((a, b) => b.days - a.days)[0];

        if (mostInactive) {
          fallbackInsights.push({
            type: 'warning',
            text: `⚠️ **${mostInactive.client.name}** não realiza compras há ${mostInactive.days} dias. Que tal mandar um WhatsApp?`
          });
        }

        // 3. Destacar melhor cliente
        const clientStats = clientBalances.map(cb => {
          const totalSpent = cb.sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
          return { client: cb.client, totalSpent, count: cb.sales.length };
        });

        const topSpent = clientStats
          .filter(cs => cs.totalSpent > 0)
          .sort((a, b) => b.totalSpent - a.totalSpent)[0];

        if (topSpent) {
          fallbackInsights.push({
            type: 'success',
            text: `📈 **${topSpent.client.name}** é o seu maior cliente em volume, totalizando R$ ${topSpent.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em compras.`
          });
        }

        // Fallback caso não tenhamos gerado nenhum dos acima
        if (fallbackInsights.length === 0) {
          fallbackInsights.push({
            type: 'success',
            text: '✨ **Tudo em dia!** Seus clientes estão ativos e com as contas em dia. Registre novas vendas para ver novos insights.'
          });
        }
      }

      return NextResponse.json({ insights: fallbackInsights.slice(0, 3) });
    }

    // Serialização dos dados como payload JSON pequeno para o Claude
    const dataPayload = {
      overview: {
        totalRevenue,
        totalFiado,
        clientsCount: clientsList.length,
        salesCount: salesList.length
      },
      clients: clientsList.map(c => ({
        name: c.name,
        type: c.type,
        contact: c.contact,
        fiado_limit: c.fiado_limit,
        updated_at: c.updated_at
      })),
      recentSales: salesList.slice(0, 30).map(s => ({
        client: clientsList.find(c => c.id === s.client_id)?.name || 'Venda Direta',
        amount: s.total_amount,
        payment_method: s.payment_method,
        status: s.status,
        date: s.created_at
      }))
    };

    const systemPrompt = `Você é um analista de dados especialista em finanças e CRM de comércio de hortifrúti.
Sua tarefa é ler um dump de dados de vendas de caixas de frutas do CEAGESP e extrair de 2 a 4 insights analíticos/recomendações inteligentes acionáveis para o usuário do Box.
O usuário atual possui o papel de: ${role === 'vendedor' ? 'Vendedor (seller)' : 'Administrador (admin)'}.

${role === 'vendedor' ? `Diretrizes específicas para o Vendedor:
1. Fale diretamente com o vendedor sobre seu próprio faturamento e desempenho pessoal.
2. NUNCA compare o faturamento deste vendedor com outros colegas de forma competitiva ou desmotivadora (ex: "vendedor X vendeu mais que você").
3. NÃO exponha o faturamento consolidado global da empresa.
4. Foque em oportunidades de crescimento pessoal do vendedor (ex: "seu faturamento cresceu R$ 10.000 este mês") e em avisos sobre seus próprios clientes inativos ou fiados.` : `Diretrizes específicas para o Administrador:
1. Forneça insights consolidados do faturamento global e devedores da empresa.
2. Identifique tendências de faturamento do box, comportamento de clientes e desempenho da equipe de vendedores.`}

Dores principais do comerciante:
1. Clientes inativos (ex: cliente que comprava sempre e sumiu).
2. Fiados acumulando (alerta para clientes com valores altos abertos ou perto do limite).
3. Crescimento de faturamento ou concentração de vendas.

Instruções importantes:
- Escreva os textos dos insights em português, de forma curta, direta e amigável.
- Use negrito com markdown (ex: **Nome do Cliente**) para destacar nomes e valores.
- O formato de resposta DEVE ser um array JSON válido de objetos com os campos "type" e "text".
- O campo "type" deve ser obrigatoriamente um de: "warning" (para alertas de sumiço), "danger" (para fiados graves em aberto), "success" (para crescimento de clientes ou faturamento).

Exemplo de formato esperado:
[
  {
    "type": "warning",
    "text": "⚠️ **João da Quitanda** não compra há 11 dias — média dele é a cada 5. Vale ligar."
  },
  {
    "type": "danger",
    "text": "💸 **Mercado Estrela** está com R$ 680 em aberto no fiado há 14 dias. É o maior fiado da carteira."
  }
]
Não adicione qualquer explicação fora do bloco JSON. Retorne apenas o array JSON puro.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Aqui estão os dados da firma do box do CEAGESP:\n${JSON.stringify(dataPayload, null, 2)}`
        }
      ]
    });

    const contentText = response.content[0].type === 'text' ? response.content[0].text : '';
    
    // Safely parse JSON array from response
    try {
      const parsedInsights = JSON.parse(contentText.trim());
      return NextResponse.json({ insights: parsedInsights });
    } catch {
      // In case Claude outputs preambles, find the json bounds
      const startIdx = contentText.indexOf('[');
      const endIdx = contentText.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonText = contentText.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonText);
        return NextResponse.json({ insights: parsed });
      }
      throw new Error('Falha ao analisar a resposta JSON da IA.');
    }
  } catch (err: any) {
    console.error('Erro ao gerar insights Claude:', err);
    const errorFallback = [
      {
        type: 'success',
        text: `✨ Seus dados estão em dia! Cadastre vendas e fiados para colher insights analíticos sobre seus clientes do CEAGESP.`
      }
    ];
    return NextResponse.json({ insights: errorFallback });
  }
}
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
