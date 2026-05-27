import { supabase } from './supabase';

interface OfflineMutation {
  id: string;
  table: string;
  action: 'insert' | 'update';
  data: any;
  timestamp: number;
}

const QUEUE_KEY = 'boxhub_offline_mutations_queue';
const CACHE_PREFIX = 'boxhub_cache_';

/**
 * Salva dados de leitura no cache local do navegador para uso offline
 */
export function cacheData(key: string, data: any): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data));
    }
  } catch (e) {
    console.error('[Offline Cache] Erro ao gravar cache:', e);
  }
}

/**
 * Recupera dados de leitura salvos localmente caso a rede falhe
 */
export function getCachedData<T>(key: string): T | null {
  try {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      return cached ? JSON.parse(cached) as T : null;
    }
  } catch (e) {
    console.error('[Offline Cache] Erro ao ler cache:', e);
  }
  return null;
}

/**
 * Enfileira uma mutação de escrita no localStorage para sincronização posterior
 */
export function queueOfflineMutation(table: string, action: 'insert' | 'update', data: any): void {
  try {
    if (typeof window === 'undefined') return;

    const queue: OfflineMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    
    const newMutation: OfflineMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      table,
      action,
      data,
      timestamp: Date.now()
    };

    queue.push(newMutation);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[Offline Queue] Ação gravada na fila local para a tabela "${table}":`, data);
  } catch (e) {
    console.error('[Offline Queue] Falha ao enfileirar mutação offline:', e);
  }
}

/**
 * Executa a sincronização em lote da fila offline com o banco de dados Supabase real
 */
export async function syncOfflineQueue(supabaseClient: any): Promise<{ success: boolean; syncedCount: number }> {
  if (typeof window === 'undefined' || !supabaseClient) return { success: false, syncedCount: 0 };
  
  // Se estiver explicitamente offline, nem tenta
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0 };
  }

  const queue: OfflineMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (queue.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  console.log(`[Offline Sync] Sincronização iniciada. ${queue.length} alterações pendentes...`);
  
  let syncedCount = 0;
  const remainingQueue: OfflineMutation[] = [];

  for (const mutation of queue) {
    try {
      let error = null;

      if (mutation.action === 'insert') {
        const { error: insertError } = await supabaseClient
          .from(mutation.table)
          .insert(mutation.data);
        error = insertError;
      } else if (mutation.action === 'update') {
        // Assume que data possui a chave 'id' para efetuar o update
        const { id, ...updatePayload } = mutation.data;
        const { error: updateError } = await supabaseClient
          .from(mutation.table)
          .update(updatePayload)
          .eq('id', id);
        error = updateError;
      }

      if (error) {
        console.error(`[Offline Sync] Falha ao sincronizar registro da tabela ${mutation.table}:`, error.message);
        // Mantém na fila para tentar novamente
        remainingQueue.push(mutation);
      } else {
        syncedCount++;
        console.log(`[Offline Sync] Registro sincronizado com sucesso na tabela ${mutation.table}.`);
      }
    } catch (err: any) {
      console.error(`[Offline Sync] Erro de rede ao sincronizar tabela ${mutation.table}:`, err.message);
      remainingQueue.push(mutation);
    }
  }

  // Grava a fila atualizada com o que sobrou
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
  
  if (syncedCount > 0) {
    // Disparar evento global para atualizar as telas
    window.dispatchEvent(new CustomEvent('offline-data-synced'));
  }

  return { success: remainingQueue.length === 0, syncedCount };
}

/**
 * Hook ou Listener para registrar escutas globais e auto-sincronizar ao voltar a ficar online
 */
export function initOfflineSync(supabaseClient: any): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('[Offline Engine] Conexão restaurada! Iniciando sincronização automática...');
    syncOfflineQueue(supabaseClient);
  };

  // Escuta evento de conectividade nativa
  window.addEventListener('online', handleOnline);

  // Executa uma primeira tentativa no carregamento
  setTimeout(() => {
    syncOfflineQueue(supabaseClient);
  }, 3000);

  // Roda uma verificação periódica a cada 30 segundos
  const interval = setInterval(() => {
    syncOfflineQueue(supabaseClient);
  }, 30000);

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}
