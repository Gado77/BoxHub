import Link from 'next/link';
import { Shield, ChevronLeft } from 'lucide-react';

export default function PrivacidadePage() {
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
          <Shield size={32} style={{ color: 'var(--primary, #1d9e75)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Política de Privacidade</h1>
        </div>

        <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Última atualização: 27 de maio de 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            1. Compromisso com a LGPD
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            A privacidade dos seus dados e dos dados dos seus clientes é prioridade máxima no BoxHub. Nós operamos em total conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD), garantindo transparência, segurança e respeito aos direitos dos titulares dos dados.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            2. Quais dados coletamos
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db', marginBottom: '1rem' }}>
            Para que você utilize os recursos operacionais do CRM, processamos os seguintes tipos de dados:
          </p>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            <li><strong>Dados do Boxista/Membros:</strong> Nome completo, endereço de e-mail de trabalho, cargo, informações da empresa (CNPJ, nome fantasia do Box) e dados de cobrança via Stripe.</li>
            <li><strong>Dados dos seus Clientes (Titulares de Dados):</strong> Nome do cliente, segmento comercial (quitanda, mercado, etc.), número de contato de WhatsApp/telefone e registros financeiros internos relacionados ao saldo devedor (limite e amortizações de fiado).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            3. Finalidade do Processamento
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db', marginBottom: '1rem' }}>
            Os dados hortifrútis e transacionais inseridos na plataforma são processados unicamente para:
          </p>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            <li>Viabilizar as operações diárias de registro de vendas e controle de estoque de frutas e legumes.</li>
            <li>Gerenciar saldos de fiado e amortizações FIFO de forma integrada.</li>
            <li>Enviar lembretes operacionais e cobranças via WhatsApp mediante sua ação explícita.</li>
            <li>Garantir a segurança física dos dados por meio de políticas de segurança de locação multitenant (RLS no Supabase).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            4. Compartilhamento com Terceiros
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db', marginBottom: '1.5rem' }}>
            O BoxHub **não vende nem comercializa** nenhum dado coletado. O compartilhamento ocorre estritamente com nossos provedores de infraestrutura necessários para a prestação do serviço:
          </p>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            <li><strong>Supabase Inc:</strong> Armazenamento seguro de banco de dados baseado em nuvem nos servidores AWS.</li>
            <li><strong>Stripe Inc:</strong> Processamento seguro de pagamentos e assinaturas recorrentes com certificação PCI-DSS.</li>
            <li><strong>Sentry:</strong> Monitoramento de erros de código e estabilidade do sistema em tempo real.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#ffffff' }}>
            5. Retenção e Segurança dos Dados
          </h2>
          <p style={{ lineHeight: '1.6', fontSize: '0.95rem', color: '#d1d5db' }}>
            Todas as transações e dados de clientes são blindados com Row Level Security (RLS) no nível do banco de dados, garantindo que usuários de outros Boxes não tenham visibilidade nem acesso físico aos seus dados. Os dados são mantidos em nossos servidores ativos enquanto sua conta estiver ativa, e podem ser permanentemente excluídos ou exportados mediante solicitação do administrador.
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
