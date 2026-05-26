import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isMockMode = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('your-project-id') || 
  supabaseAnonKey.includes('your-anon-key');

export function createClient() {
  if (isMockMode) {
    return null;
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
