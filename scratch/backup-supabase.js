const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local file from workspace root
const envPath = path.join(process.cwd(), '.env.local');
console.log('Lendo variáveis de ambiente de:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env.local não encontrado! Execute a partir do diretório raiz do projeto.');
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
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Chaves NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no .env.local!');
  process.exit(1);
}

// Conectar usando o Service Role para bypassar RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const TABLES = [
  'organizations',
  'profiles',
  'clients',
  'products',
  'product_variants',
  'sales',
  'sale_items',
  'fiado_payments',
  'subscriptions',
  'audit_logs',
  'rate_limits'
];

async function runBackup() {
  console.log('🚀 Iniciando backup de dados do Supabase...');
  
  const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const backupDirName = `backup-${timestamp}`;
  const backupDirPath = path.join(process.cwd(), 'backups', backupDirName);

  // Criar pasta de backups se não existir
  if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
    fs.mkdirSync(path.join(process.cwd(), 'backups'));
  }
  fs.mkdirSync(backupDirPath);
  console.log(`📁 Criada pasta de backup em: ${backupDirPath}\n`);

  for (const table of TABLES) {
    console.log(`⏳ Exportando tabela [${table}]...`);
    try {
      let allData = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;

      // Paginação para lidar com tabelas muito grandes sem estourar limites de memória
      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          page++;
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      const filePath = path.join(backupDirPath, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(allData, null, 2), 'utf8');
      console.log(`   ✅ Tabela [${table}] exportada. Registros: ${allData.length}`);
    } catch (err) {
      console.error(`   ❌ Erro ao exportar tabela [${table}]:`, err.message);
    }
  }

  console.log(`\n🎉 Backup concluído com sucesso! Pasta de destino: backups/${backupDirName}`);
}

runBackup();
