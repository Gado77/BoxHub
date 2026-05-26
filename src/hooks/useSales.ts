import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { Sale } from '@/lib/types';
import { useOrg } from './useOrg';

export function useSales() {
  const { org, loading: orgLoading } = useOrg();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    if (!org) {
      setSales([]);
      setLoading(false);
      return;
    }
    try {
      if (isMockMode) {
        const list = mockDb.sales.list();
        setSales(list as Sale[]);
      } else {
        const { data, error } = await supabase!
          .from('sales')
          .select('*, profiles:seller_id(*), clients:client_id(*)')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSales(data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar vendas:', err);
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    if (!orgLoading) {
      fetchSales();
    }
  }, [orgLoading, fetchSales]);

  return { sales, loading: orgLoading || loading, refetch: fetchSales };
}
