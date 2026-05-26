import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { Profile } from '@/lib/types';

export function useAuth() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = useCallback(async () => {
    try {
      if (isMockMode) {
        const currentUser = mockDb.getCurrentUser();
        setUser(currentUser as Profile);
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (session) {
          const { data: profile } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(profile);
        } else {
          setUser(null);
        }
      }
    } catch (err) {
      console.error('Erro ao verificar autenticação:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();

    if (typeof window !== 'undefined') {
      window.addEventListener('profile-updated', checkUser);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('profile-updated', checkUser);
      }
    };
  }, [checkUser]);

  return { user, loading, refetch: checkUser };
}
