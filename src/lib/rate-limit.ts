const trackers = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Limitador de taxa em memória simples e leve para rotas de API.
 * Nota: Em ambientes serverless (Vercel), a memória é compartilhada apenas 
 * durante a vida útil do container, o que é suficiente para proteção básica contra abusos.
 * 
 * @param ip Identificador único do cliente (geralmente o IP)
 * @param limit Limite máximo de requisições permitidas na janela de tempo
 * @param windowMs Tamanho da janela de tempo em milissegundos
 */
export function rateLimit(ip: string, limit: number, windowMs: number): RateLimitResponse {
  const now = Date.now();
  const tracker = trackers.get(ip);

  // Limpeza proativa de registros expirados para evitar vazamento de memória
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
