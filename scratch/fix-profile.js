const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function fix() {
  const userId = 'ada7734d-8426-4d61-bccf-c6492c289db1';
  const orgId = '8dbbe719-2d17-41ad-bcb8-abe97e8b99fc'; // Vitin Frutas
  
  console.log(`Inserindo perfil para o usuário ID: ${userId} na organização ID: ${orgId}...`);
  
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      organization_id: orgId,
      name: 'Vitor 2',
      role: 'admin',
      email: 'vi.emanoel20152015@gmail.com'
    })
    .select();

  if (error) {
    console.error('Erro ao criar perfil:', error);
  } else {
    console.log('Perfil criado com sucesso:', data);
  }
}

fix().catch(console.error);
