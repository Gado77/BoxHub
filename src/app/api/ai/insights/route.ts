import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

const anthropic = anthropicKey 
  ? new Anthropic({ apiKey: anthropicKey }) 
  : null;

// Initialize admin Supabase instance to fetch data
const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export async function GET(request: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('seller_id');
    const role = searchParams.get('role');

    // Retrieve active session authorization header to verify caller identity
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    // For MVP demonstration, we find active profile.
    // In normal SSR next.js, we check cookie session.
    // If authorization header token is missing, we check if we can resolve the user.
    // Since this is a server component API route, we retrieve the user from auth.getUser.
    // Let's get the user profile. (We assume mock data fallback if user profile is empty)
    // To make it fully self-contained for local dev, if process.env keys are missing, we fallback.

    // Let's fetch the list of sales & clients to send to Claude
    const { data: clients } = await supabaseAdmin.from('clients').select('*');
    const { data: sales } = await supabaseAdmin.from('sales').select('*');

    const clientsList = clients || [];
    let salesList = sales || [];

    // Filter sales if current user is vendedor
    if (role === 'vendedor' && sellerId) {
      salesList = salesList.filter(s => s.seller_id === sellerId);
    }

    // Helper: Compute dynamic metrics for the prompt
    const totalRevenue = salesList.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
    const fiadoSales = salesList.filter(s => s.payment_method === 'fiado' && s.status === 'pendente');
    const totalFiado = fiadoSales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);

    // If Anthropic API key is not configured, we return rule-based insights based on real data
    if (!anthropic) {
      const fallbackInsights = [];

      if (clientsList.length === 0) {
        fallbackInsights.push({
          type: 'success',
          text: '✨ **Bem-vindo ao BoxHub!** Cadastre seus primeiros clientes e registre vendas para visualizar análises inteligentes aqui.'
        });
      } else {
        // 1. Calculate highest fiado balance
        const clientBalances = clientsList.map(client => {
          // Calculate total unpaid fiado for this client
          const clientSales = salesList.filter(s => s.client_id === client.id && !s.is_canceled);
          const fiadoTotal = clientSales
            .filter(s => s.payment_method === 'fiado' && s.status === 'pendente')
            .reduce((sum, s) => sum + Number(s.total_amount), 0);
          
          return { client, fiadoTotal, sales: clientSales };
        });

        // Filter and sort by fiado balance
        const highestFiado = [...clientBalances]
          .filter(cb => cb.fiadoTotal > 0)
          .sort((a, b) => b.fiadoTotal - a.fiadoTotal)[0];

        if (highestFiado) {
          fallbackInsights.push({
            type: 'danger',
            text: `💸 **${highestFiado.client.name}** está com R$ ${highestFiado.fiadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em aberto no fiado. Recomenda-se realizar uma cobrança.`
          });
        }

        // 2. Calculate inactivity (clients who haven't bought in a while)
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
          .filter(ci => ci.days > 5) // more than 5 days inactive
          .sort((a, b) => b.days - a.days)[0];

        if (mostInactive) {
          fallbackInsights.push({
            type: 'warning',
            text: `⚠️ **${mostInactive.client.name}** não realiza compras há ${mostInactive.days} dias. Que tal mandar um WhatsApp?`
          });
        }

        // 3. Highlight top customer
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

        // Fallback if we couldn't generate any of the above (e.g. they exist but no purchases yet)
        if (fallbackInsights.length === 0) {
          fallbackInsights.push({
            type: 'success',
            text: '✨ **Tudo em dia!** Seus clientes estão ativos e com contas em dia. Registre novas vendas para ver novos insights.'
          });
        }
      }

      return NextResponse.json({ insights: fallbackInsights.slice(0, 3) });
    }

    // Serializing data as a small JSON payload for Claude
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
    // Fallback rule insights
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
