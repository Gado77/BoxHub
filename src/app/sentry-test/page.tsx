'use client';

export default function SentryTestPage() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh', 
      gap: '1rem',
      fontFamily: 'sans-serif',
      backgroundColor: '#0a0a0a',
      color: '#ffffff'
    }}>
      <h1>Teste de Integração do Sentry</h1>
      <p style={{ opacity: 0.7 }}>Clique no botão abaixo para disparar um erro de simulação.</p>
      
      <button 
        onClick={() => {
          throw new Error('Teste Sentry BoxHub - Verificação de Produção');
        }}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#e11d48',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
          transition: 'transform 0.1s'
        }}
        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Disparar Erro de Teste
      </button>
    </div>
  );
}
