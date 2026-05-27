'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro catastrófico no root layout capturado:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0f1d',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '90%',
          padding: '2.5rem',
          borderRadius: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#111827',
          textAlign: 'center'
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
            color: '#ef4444'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Erro Crítico do Sistema
          </h2>
          
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            Ocorreu uma falha grave na infraestrutura básica do BoxHub. Nossa equipe técnica já foi notificada via telemetria Sentry.
          </p>

          {error.message && (
            <code style={{
              display: 'block',
              width: '100%',
              padding: '0.75rem',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#9ca3af',
              textAlign: 'left',
              overflowX: 'auto',
              marginBottom: '2rem',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}>
              {error.message}
            </code>
          )}

          <button
            onClick={() => reset()}
            style={{
              width: '100%',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            Recarregar Aplicação
          </button>
        </div>
      </body>
    </html>
  );
}
