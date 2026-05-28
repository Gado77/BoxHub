'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      
      // Determine destination based on search params or hash
      const isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');
      const isInvite = hash.includes('type=invite') || search.includes('type=invite') || hash.includes('type=signup') || search.includes('type=signup');

      if (isRecovery) {
        router.replace('/reset-password' + search + hash);
      } else if (isInvite) {
        router.replace('/welcome' + search + hash);
      } else {
        router.replace('/login' + search + hash);
      }
    }
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      backgroundColor: '#0a0a0a', 
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Redirecionando...</p>
      </div>
    </div>
  );
}
