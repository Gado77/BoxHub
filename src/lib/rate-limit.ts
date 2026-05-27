import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Inicializar cliente administrativo para gerenciar rate limits de forma isolada
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const isMockMode = process.env.NEXT_PUBLIC_DISABLE_MOCK === 'true'
  ? false
  : (
      !supabaseUrl || 
      !serviceRoleKey || 
      supabaseUrl.includes('your-project-id')
    );

const trackers = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Limitador de taxa atômico baseado em banco de dados para rotas de API em produção,
 * com fallback para em memória em modo de desenvolvimento/mock ou falhas de conexão.
 */
export async function rateLimit(
  ip: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResponse> {
  const now = Date.now();

  // Se em modo Mock ou se o cliente admin não estiver configurado, usamos o modo em memória
  if (isMockMode || !supabaseAdmin) {
    return fallbackInMemory(ip, limit, windowMs);
  }

  // Se em modo real com Supabase, usamos a RPC check_rate_limit
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: ip,
      p_limit: limit,
      p_window_ms: windowMs
    });

    if (error) {
      console.error('[Rate Limit] Erro RPC ao verificar rate limit, utilizando fallback em memória:', error.message);
      return fallbackInMemory(ip, limit, windowMs);
    }

    return {
      success: data.success,
      limit: data.limit,
      remaining: data.remaining,
      reset: Number(data.reset)
    };
  } catch (err: any) {
    console.error('[Rate Limit] Erro catastrófico ao conectar ao Supabase, utilizando fallback em memória:', err.message);
    return fallbackInMemory(ip, limit, windowMs);
  }
}

/**
 * Fallback em memória síncrono e limpo.
 */
function fallbackInMemory(ip: string, limit: number, windowMs: number): RateLimitResponse {
  const now = Date.now();
  const tracker = trackers.get(ip);

  // Limpeza proativa de registros expirados para evitar vazamentos de memória no container
  if (trackers.size > 5000) {
    for (const [key, value] of trackers.entries()) {
      if (now > value.resetTime) {
        trackers.delete(key);
      }
    }
  }

  if (!tracker) {
    trackers.set(ip, { count: 1, resetTime: now + windowMs });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowMs,
    };
  }

  if (now > tracker.resetTime) {
    tracker.count = 1;
    tracker.resetTime = now + windowMs;
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: tracker.resetTime,
    };
  }

  tracker.count++;
  const remaining = Math.max(0, limit - tracker.count);

  return {
    success: tracker.count <= limit,
    limit,
    remaining,
    reset: tracker.resetTime,
  };
}
