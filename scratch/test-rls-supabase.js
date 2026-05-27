const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local file from workspace root
const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local não encontrado! Execute na raiz do projeto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  console.error('❌ Chaves do Supabase ausentes no .env.local!');
  process.exit(1);
}

// 1. Cliente Admin para Setup e Limpeza
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Helper para criar conexões de usuários comuns
const createAnonClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

const TEST_PASSWORD = 'TestPassword123!';

async function runRlsTests() {
  console.log('🧪 Iniciando testes de segurança Row Level Security (RLS) no Supabase...');
  
  const suffix = Math.random().toString(36).substring(7);
  const emailAdminA = `admin_a_${suffix}@boxhub-test.com`;
  const emailAdminB = `admin_b_${suffix}@boxhub-test.com`;
  const emailVendedorA = `vendedor_a_${suffix}@boxhub-test.com`;
  const emailNoOrg = `no_org_${suffix}@boxhub-test.com`;

  let orgA, orgB;
  let userAdminA, userAdminB, userVendedorA, userNoOrg;
  
  try {
    // --- 2. SETUP DOS DADOS DE TESTE (VIA ADMIN CLIENT) ---
    console.log('⚙️ Criando organizações de teste...');
    const { data: orgAData, error: errOrgA } = await supabaseAdmin.from('organizations').insert({ name: `Org Test A (${suffix})` }).select().single();
    const { data: orgBData, error: errOrgB } = await supabaseAdmin.from('organizations').insert({ name: `Org Test B (${suffix})` }).select().single();
    if (errOrgA || errOrgB) throw new Error(`Falha ao criar organizações de teste: ${errOrgA?.message || errOrgB?.message}`);
    orgA = orgAData;
    orgB = orgBData;

    console.log('⚙️ Criando usuários de teste no Auth...');
    const { data: authAdminA, error: errAuthA } = await supabaseAdmin.auth.admin.createUser({ email: emailAdminA, password: TEST_PASSWORD, email_confirm: true });
    const { data: authAdminB, error: errAuthB } = await supabaseAdmin.auth.admin.createUser({ email: emailAdminB, password: TEST_PASSWORD, email_confirm: true });
    const { data: authVendA, error: errAuthVend } = await supabaseAdmin.auth.admin.createUser({ email: emailVendedorA, password: TEST_PASSWORD, email_confirm: true });
    const { data: authNoOrg, error: errAuthNoOrg } = await supabaseAdmin.auth.admin.createUser({ email: emailNoOrg, password: TEST_PASSWORD, email_confirm: true });
    if (errAuthA || errAuthB || errAuthVend || errAuthNoOrg) {
      throw new Error(`Falha ao criar credenciais de teste: ${errAuthA?.message || errAuthB?.message || errAuthVend?.message || errAuthNoOrg?.message}`);
    }
    userAdminA = authAdminA.user;
    userAdminB = authAdminB.user;
    userVendedorA = authVendA.user;
    userNoOrg = authNoOrg.user;

    console.log('⚙️ Criando perfis na tabela pública...');
    await supabaseAdmin.from('profiles').insert([
      { id: userAdminA.id, organization_id: orgA.id, name: 'Admin Org A', role: 'admin', email: emailAdminA },
      { id: userAdminB.id, organization_id: orgB.id, name: 'Admin Org B', role: 'admin', email: emailAdminB },
      { id: userVendedorA.id, organization_id: orgA.id, name: 'Vendedor Org A', role: 'vendedor', email: emailVendedorA }
      // userNoOrg intencionalmente não ganha perfil associado a nenhuma organização
    ]);

    console.log('⚙️ Inserindo dados de vendas e clientes associados...');
    const { data: clientA } = await supabaseAdmin.from('clients').insert({ name: 'Cliente da Org A', organization_id: orgA.id, type: 'quitanda', fiado_limit: 1000 }).select().single();
    const { data: clientB } = await supabaseAdmin.from('clients').insert({ name: 'Cliente da Org B', organization_id: orgB.id, type: 'mercado', fiado_limit: 2000 }).select().single();

    console.log('🔑 Efetuando autenticação dos clientes de teste...');
    const clientAConn = createAnonClient();
    const clientBConn = createAnonClient();
    const clientVendConn = createAnonClient();
    const clientNoOrgConn = createAnonClient();

    const { error: loginA } = await clientAConn.auth.signInWithPassword({ email: emailAdminA, password: TEST_PASSWORD });
    const { error: loginB } = await clientBConn.auth.signInWithPassword({ email: emailAdminB, password: TEST_PASSWORD });
    const { error: loginVend } = await clientVendConn.auth.signInWithPassword({ email: emailVendedorA, password: TEST_PASSWORD });
    const { error: loginNoOrg } = await clientNoOrgConn.auth.signInWithPassword({ email: emailNoOrg, password: TEST_PASSWORD });
    if (loginA || loginB || loginVend || loginNoOrg) throw new Error('Falha no login dos usuários de teste.');

    // --- 3. EXECUTAR ASSERÇÕES DE SEGURANÇA (RLS) ---
    console.log('\n--- 🧪 Executando Testes RLS ---\n');

    // Teste 1: Usuário da Empresa A tentando ler dados da Empresa B
    console.log('📋 Teste 1: Isolamento Multi-tenant (Org A -> Org B)...');
    const { data: clientsA, error: clientsAError } = await clientAConn.from('clients').select('id, name');
    if (clientsAError) console.error('   ❌ Falha ao ler clientes:', clientsAError.message);
    const hasOrgBClient = clientsA.some(c => c.id === clientB.id);
    if (!hasOrgBClient) {
      console.log('   ✅ Sucesso! Admin A não conseguiu visualizar o cliente da Org B.');
    } else {
      console.error('   ❌ Falha! Vazamento de dados detectado: Admin A visualizou clientes da Org B.');
    }

    // Teste 2: Acesso direto cruzado utilizando ID explícito de outra org
    console.log('📋 Teste 2: Tentativa de leitura cruzada direta via filtro ID...');
    const { data: directClientB, error: directBError } = await clientAConn.from('clients').select('*').eq('id', clientB.id);
    if (directClientB.length === 0) {
      console.log('   ✅ Sucesso! Admin A não conseguiu ler o cliente B por ID direto.');
    } else {
      console.error('   ❌ Falha! Admin A conseguiu acessar informações confidenciais do cliente B.');
    }

    // Teste 3: Vendedor tentando acessar área de admin (criação de membros na equipe)
    console.log('📋 Teste 3: Vendedor A tentando cadastrar novo membro (Admin-Only)...');
    const { data: newProfile, error: profileError } = await clientVendConn.from('profiles').insert({
      id: '00000000-0000-0000-0000-000000000000',
      organization_id: orgA.id,
      name: 'Vendedor Hacker',
      role: 'admin'
    }).select();
    // Como RLS de insert na tabela profiles exige cargo admin do chamador, vendedor deve ser bloqueado
    if (profileError || !newProfile || newProfile.length === 0) {
      console.log('   ✅ Sucesso! Vendedor foi bloqueado de inserir perfis na equipe.');
    } else {
      console.error('   ❌ Falha! Vendedor conseguiu criar um perfil administrativo burlado.');
    }

    // Teste 4: Usuário sem organização cadastrada tentando acessar dados do dashboard
    console.log('📋 Teste 4: Usuário sem organização tentando ler tabelas operacionais...');
    const { data: clientsNoOrg, error: noOrgError } = await clientNoOrgConn.from('clients').select('*');
    if (clientsNoOrg.length === 0) {
      console.log('   ✅ Sucesso! Usuário órfão sem organização não visualizou nenhum cliente.');
    } else {
      console.error('   ❌ Falha! Usuário sem organização conseguiu ler dados do sistema.');
    }

    console.log('\n----------------------------------------');
    console.log('🏁 Todos os cenários de testes de RLS executados.');

  } catch (err) {
    console.error('❌ Ocorreu um erro catastrófico durante os testes:', err.message);
  } finally {
    // --- 4. CLEANUP (VIA ADMIN CLIENT) ---
    console.log('\n🧹 Iniciando limpeza do banco de dados...');
    try {
      if (userAdminA) await supabaseAdmin.auth.admin.deleteUser(userAdminA.id);
      if (userAdminB) await supabaseAdmin.auth.admin.deleteUser(userAdminB.id);
      if (userVendedorA) await supabaseAdmin.auth.admin.deleteUser(userVendedorA.id);
      if (userNoOrg) await supabaseAdmin.auth.admin.deleteUser(userNoOrg.id);
      
      // Deletar as organizações de teste (o cascade do postgres limpa os perfis e clientes)
      if (orgA) await supabaseAdmin.from('organizations').delete().eq('id', orgA.id);
      if (orgB) await supabaseAdmin.from('organizations').delete().eq('id', orgB.id);
      
      console.log('🧹 Limpeza concluída com sucesso.');
    } catch (cleanError) {
      console.error('⚠️ Falha ao limpar registros de teste:', cleanError.message);
    }
  }
}

runRlsTests();
