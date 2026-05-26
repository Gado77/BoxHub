import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { Client } from '@/lib/types';
import { useOrg } from './useOrg';

export function useClients() {
  const { org, loading: orgLoading } = useOrg();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!org) {
      setClients([]);
      setLoading(false);
      return;
    }
    try {
      if (isMockMode) {
        const list = mockDb.clients.list();
        setClients(list as Client[]);
      } else {
        const { data, error } = await supabase!
          .from('clients')
          .select('*')
          .eq('organization_id', org.id)
          .order('name', { ascending: true });

        if (error) throw error;
        setClients(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    if (!orgLoading) {
      fetchClients();
    }
  }, [orgLoading, fetchClients]);

  return { clients, loading: orgLoading || loading, refetch: fetchClients };
}
