import Link from 'next/link';
import { Sprout, ChevronLeft } from 'lucide-react';

export default function TermosPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main, #0b0f19)',
      color: 'var(--text-main, #f3f4f6)',
      padding: '2rem 1rem',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link href="/login" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--primary, #1d9e75)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'opacity 0.2s'
          }}>
            <ChevronLeft size={16} />
            Voltar para o Login
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Sprout size={32} style={{ color: 'var(--primary, #1d9e75)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Termos de Uso</h1>
        </div>

        <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Última atualização: 27 de maio de 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            1. Aceitação dos Termos
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            Ao criar uma conta ou utilizar a plataforma BoxHub, você e a sua empresa concordam em cumprir e estar vinculados a estes Termos de Uso. Este software é um sistema SaaS B2B destinado exclusivamente à gestão comercial de comerciantes e boxistas do CEAGESP e centros de distribuição hortifrúti.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            2. Cadastro e Acesso à Plataforma
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            Para utilizar os recursos avançados, você deve registrar sua empresa (Box/Firma) fornecendo informações válidas e atualizadas. Você é inteiramente responsável pela confidencialidade das credenciais de acesso de toda a sua equipe cadastrada na plataforma.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            3. Planos, Cobrança e Cancelamento
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db', marginBottom: '1rem' }}>
            O BoxHub opera no modelo de assinatura mensal ou anual recorrente:
          </p>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            <li><strong>Período de Teste (Trial):</strong> Oferecemos 7 dias de avaliação gratuita no Plano Pro. Após este prazo, as funções premium são suspensas até que a cobrança seja configurada via Stripe.</li>
            <li><strong>Upgrades e Downgrades:</strong> Mudanças de plano refletem proporcionalmente no faturamento imediato. Em caso de downgrade, os limites de equipe e recursos serão ajustados de forma segura, preservando os dados já criados mas limitando novas inserções.</li>
            <li><strong>Cancelamentos:</strong> Podem ser solicitados a qualquer momento pelo administrador através do portal de faturamento do Stripe disponível no painel de configurações. Não há taxas de fidelidade ou multas de rescisão.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            4. Limitação de Responsabilidade
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            O BoxHub fornece ferramentas de suporte operacional para facilitação de vendas e controle financeiro de fiado. Não somos responsáveis por perdas financeiras decorrentes de inadimplência de seus clientes finais, falhas em conexões externas ou quaisquer decisões de negócios efetuadas a partir dos insights gerados pelo sistema.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            5. Legislação Aplicável
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de São Paulo/SP para dirimir quaisquer dúvidas decorrentes do uso desta plataforma.
          </p>
        </section>

        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted, #9ca3af)'
        }}>
          © {new Date().getFullYear()} BoxHub. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
