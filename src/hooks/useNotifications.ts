import { useState, useEffect, useCallback } from 'react';
import { isMockMode, mockDb } from '@/lib/supabase';
import { Notification } from '@/lib/types';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (isMockMode) {
        // Modo Mock: buscar notificações do banco simulado local
        const list = mockDb.notifications.list();
        setNotifications(list);
        setUnreadCount(list.filter((n) => n.status === 'unread').length);
      } else {
        // Modo Real: chamar endpoint API
        const res = await fetch('/api/notifications');
        if (!res.ok) {
          throw new Error('Falha ao buscar notificações do servidor.');
        }
        const data = await res.json();
        const list = data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter((n: Notification) => n.status === 'unread').length);
      }
      setError(null);
    } catch (err: any) {
      console.error('Erro ao buscar notificações:', err);
      setError(err.message || 'Erro ao carregar notificações.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      if (isMockMode) {
        mockDb.notifications.markAsRead(id);
        // Atualizar estado local
        const list = mockDb.notifications.list();
        setNotifications(list);
        setUnreadCount(list.filter((n) => n.status === 'unread').length);
      } else {
        // Otimista: atualiza status local imediatamente para UX imediata
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, status: 'read', read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'read' }),
        });

        if (!res.ok) {
          throw new Error('Falha ao marcar notificação como lida.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao marcar notificação como lida:', err);
      // Re-fetch em caso de erro para manter integridade
      fetchNotifications(true);
      setError(err.message || 'Erro ao marcar como lida.');
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      if (isMockMode) {
        mockDb.notifications.markAllAsRead();
        // Atualizar estado local
        const list = mockDb.notifications.list();
        setNotifications(list);
        setUnreadCount(0);
      } else {
        // Otimista: atualiza status local imediatamente para UX imediata
        setNotifications((prev) =>
          prev.map((n) =>
            n.status === 'unread'
              ? { ...n, status: 'read', read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount(0);

        const res = await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' }),
        });

        if (!res.ok) {
          throw new Error('Falha ao marcar todas as notificações como lidas.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao marcar todas como lidas:', err);
      // Re-fetch em caso de erro para manter integridade
      fetchNotifications(true);
      setError(err.message || 'Erro ao marcar todas como lidas.');
    }
  }, [fetchNotifications]);

  // Efeito de Polling Simples
  useEffect(() => {
    fetchNotifications();

    // Configurar polling a cada 60 segundos
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: () => fetchNotifications(),
    markAsRead,
    markAllAsRead,
  };
}
