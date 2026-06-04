import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { AsaasBillingProvider } from '@/lib/billing';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 500 });
    }

    // 1. Validar a sessão do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.' }, { status: 401 });
    }

    // 2. Buscar perfil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado.' }, { status: 404 });
    }

    // 3. Buscar a organização
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('asaas_customer_id')
      .eq('id', profile.organization_id)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 });
    }

    const customerId = org.asaas_customer_id;
    if (!customerId) {
      return NextResponse.json({ 
        error: 'Você ainda não possui um registro de faturamento no Asaas. Por favor, selecione um plano primeiro.' 
      }, { status: 400 });
    }

    // 4. Obter a URL do portal (fatura pendente)
    const provider = new AsaasBillingProvider();
    const url = await provider.getBillingPortalUrl(customerId);

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('[Asaas Portal Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Erro ao gerar link de faturamento.' },
      { status: 500 }
    );
  }
}
