'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro global de renderização capturado:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      color: 'var(--text-main)',
      backgroundColor: 'var(--bg-main)',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="glass" style={{
        maxWidth: '500px',
        padding: '2.5rem',
        borderRadius: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--bg-card)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          color: 'var(--danger)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', fontFamily: 'Outfit, sans-serif' }}>
          Algo deu muito errado!
        </h2>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
          Ocorreu uma falha crítica na aplicação. Os detalhes do erro foram enviados automaticamente para monitoramento.
        </p>

        {error.message && (
          <code style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textAlign: 'left',
            overflowX: 'auto',
            marginBottom: '2rem',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace'
          }}>
            {error.message}
          </code>
        )}

        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          <button
            onClick={() => reset()}
            style={{
              flex: 1,
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            Tentar Novamente
          </button>
          
          <Link
            href="/"
            style={{
              flex: 1,
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              fontSize: '0.875rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontWeight: 600
            }}
          >
            Ir para Início
          </Link>
        </div>
      </div>
    </div>
  );
}
