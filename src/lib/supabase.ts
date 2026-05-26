import { createBrowserClient } from '@supabase/ssr';

// Re-exportar tipos para retrocompatibilidade
export * from './types';

// Re-exportar lógica e dados mockados para retrocompatibilidade
export * from './mock';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isMockMode = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('your-project-id') || 
  supabaseAnonKey.includes('your-anon-key');

if (isMockMode) {
  console.warn('⚠️ BoxHub rodando em modo MOCK. Nenhuma chave do Supabase configurada no .env.');
}

export const supabase = !isMockMode 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey) 
  : null;

// BoxHub CRM branding — logotipos baseados em tema
export const CRM_BRANDING = {
  logoDark: 'https://jblkxmtsfbsmjsutujsj.supabase.co/storage/v1/object/public/Arquivos/boxhub-black-theme.png',
  logoLight: 'https://jblkxmtsfbsmjsutujsj.supabase.co/storage/v1/object/public/Arquivos/boxhub-white-theme.png',
  logoIcon: 'https://jblkxmtsfbsmjsutujsj.supabase.co/storage/v1/object/public/Arquivos/boxhub-icone.png',
} as const;
