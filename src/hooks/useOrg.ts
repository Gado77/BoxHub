import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { Organization } from '@/lib/types';
import { useAuth } from './useAuth';

export function useOrg() {
  const { user, loading: authLoading } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrg = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setLoading(false);
      return;
    }
    try {
      if (isMockMode) {
        const currentOrg = mockDb.getOrg();
        setOrg(currentOrg as Organization);
      } else {
        const { data: organization } = await supabase!
          .from('organizations')
          .select('*')
          .eq('id', user.organization_id)
          .single();
        setOrg(organization);
      }
    } catch (err) {
      console.error('Erro ao buscar organização:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrg();
    }
  }, [authLoading, fetchOrg]);

  return { org, loading: authLoading || loading, refetch: fetchOrg };
}
