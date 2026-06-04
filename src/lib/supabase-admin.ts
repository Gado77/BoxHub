import { createClient } from '@supabase/supabase-js';

/**
 * Retorna uma instância do Supabase Admin Client inicializada de forma lazy (sob demanda).
 * Evita ler variáveis de ambiente em tempo de importação de módulo.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.');
    return null;
  }
  
  return createClient(url, key);
}
