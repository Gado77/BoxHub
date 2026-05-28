const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler .env.local manualmente para evitar dependências adicionais
let supabaseUrl = '';
let supabaseServiceKey = '';

try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      supabaseServiceKey = line.split('=')[1].trim();
    }
  }
} catch (e) {
  console.error('Erro ao ler .env.local:', e.message);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: Credenciais do Supabase não encontradas no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const userId = 'ada7734d-8426-4d61-bccf-c6492c289db1';
  console.log(`Buscando perfil para o usuário ID: ${userId}...`);
  
  // 1. Verificar na tabela public.profiles
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('*, organizations(*)')
    .eq('id', userId)
    .maybeSingle();

  if (profError) {
    console.error('Erro ao buscar perfil:', profError);
  } else {
    console.log('Perfil encontrado:', profile);
  }

  // 2. Verificar na tabela auth.users se ele existe e qual o e-mail cadastrado
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError) {
    console.error('Erro ao buscar usuário no Auth:', authError);
  } else {
    console.log('Usuário no Auth:', {
      id: authUser.user.id,
      email: authUser.user.email,
      confirmed_at: authUser.user.confirmed_at,
      last_sign_in_at: authUser.user.last_sign_in_at
    });
  }

  // 3. Listar todas as organizações existentes
  console.log('Buscando organizações na produção...');
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*');
    
  if (orgsError) {
    console.error('Erro ao buscar organizações:', orgsError);
  } else {
    console.log('Organizações encontradas:', orgs.map(o => ({ id: o.id, name: o.name })));
  }
}

check().catch(console.error);
