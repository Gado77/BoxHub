'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { 
  Coins, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  X, 
  DollarSign, 
  MessageSquare,
  Percent,
  CheckCircle,
  Calendar
} from 'lucide-react';
import styles from './fiado.module.css';

interface ProcessedClient {
  id: string;
  name: string;
  type: string;
  contact: string;
  fiado_limit: number;
  balance: number;
  lastSaleDate: string;
  usedPercent: number;
}

export default function FiadoPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ProcessedClient[]>([]);
  const [stats, setStats] = useState({
    totalReceber: 0,
    devedoresCount: 0,
    limiteComprometido: 0,
    ticketMedio: 0
  });

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<'todos' | 'alto' | 'atencao' | 'saudavel'>('todos');
  const [sortBy, setSortBy] = useState<'balance' | 'usage' | 'name'>('balance');

  // Amortization Modal State
  const [selectedClient, setSelectedClient] = useState<ProcessedClient | null>(null);
  const [isAmortizeModalOpen, setIsAmortizeModalOpen] = useState(false);
  const [amortizeAmount, setAmortizeAmount] = useState('');
  const [amortizeMethod, setAmortizeMethod] = useState<'pix' | 'dinheiro'>('pix');
  const [amortizeLoading, setAmortizeLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let clientsList: any[] = [];
      let salesList: any[] = [];
      let paymentsList: any[] = [];

      if (isMockMode) {
        clientsList = mockDb.clients.list();
        salesList = mockDb.sales.list();
        paymentsList = mockDb.fiado.paymentsList();
      } else {
        // Fetch all clients, sales, and payments in parallel
        const [clientsRes, salesRes, paymentsRes] = await Promise.all([
          supabase!.from('clients').select('*'),
          supabase!
            .from('sales')
            .select('id, client_id, total_amount, payment_method, status, is_canceled, created_at')
            .eq('payment_method', 'fiado'),
          supabase!.from('fiado_payments').select('id, client_id, amount, payment_method, created_at')
        ]);

        if (clientsRes.error) throw clientsRes.error;
        if (salesRes.error) throw salesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        clientsList = clientsRes.data || [];
        salesList = salesRes.data || [];
        paymentsList = paymentsRes.data || [];
      }

      // Process each client's outstanding balance & last sale date
      const processed: ProcessedClient[] = clientsList.map((client) => {
        let balance = 0;
        let lastSaleDate = 'Nenhuma';

        if (isMockMode) {
          balance = mockDb.fiado.getBalance(client.id);
          
          // Get all non-canceled sales of this client
          const clientSales = salesList
            .filter(s => s.client_id === client.id && !s.is_canceled)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          if (clientSales.length > 0) {
            lastSaleDate = new Date(clientSales[0].created_at).toLocaleDateString('pt-BR');
          }
        } else {
          // Calculate balance for Supabase mode: active fiado sales minus payments
          const clientSales = salesList.filter(
            (s) => s.client_id === client.id && s.status === 'pendente' && !s.is_canceled
          );
          const clientPayments = paymentsList.filter((p) => p.client_id === client.id);

          const totalDebt = clientSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
          const totalPaid = clientPayments.reduce((sum, p) => sum + Number(p.amount), 0);

          balance = Math.max(0, totalDebt - totalPaid);

          // Get last sale date (all sales types)
          const allClientSales = salesList
            .filter(s => s.client_id === client.id && !s.is_canceled)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          if (allClientSales.length > 0) {
            lastSaleDate = new Date(allClientSales[0].created_at).toLocaleDateString('pt-BR');
          }
        }

        const limit = Number(client.fiado_limit) || 0;
        const usedPercent = limit > 0 ? (balance / limit) * 100 : 0;

        return {
          id: client.id,
          name: client.name,
          type: client.type,
          contact: client.contact || '',
          fiado_limit: limit,
          balance,
          lastSaleDate,
          usedPercent
        };
      });

      // Filter and calculate KPIs based on ALL clients before filter states are applied
      const totalReceber = processed.reduce((sum, c) => sum + c.balance, 0);
      const devedores = processed.filter((c) => c.balance > 0);
      const devedoresCount = devedores.length;
      const ticketMedio = devedoresCount > 0 ? totalReceber / devedoresCount : 0;

      // Overall Limit Usage Indicator
      const clientsWithLimit = processed.filter((c) => c.fiado_limit > 0);
      const totalLimit = clientsWithLimit.reduce((sum, c) => sum + c.fiado_limit, 0);
      const limiteComprometido = totalLimit > 0 ? (totalReceber / totalLimit) * 100 : 0;

      setStats({
        totalReceber,
        devedoresCount,
        limiteComprometido,
        ticketMedio
      });

      setClients(processed);
    } catch (err: any) {
      console.error('Erro ao carregar dados de fiado:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Amortization handler
  const handleAmortizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !amortizeAmount || Number(amortizeAmount) <= 0) return;

    setAmortizeLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const amountNum = parseFloat(amortizeAmount);
      const clientId = selectedClient.id;

      if (isMockMode) {
        mockDb.fiado.pay(clientId, amountNum, amortizeMethod);
        await new Promise((resolve) => setTimeout(resolve, 600));
      } else {
        const { data: { user } } = await supabase!.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado.');

        const { data: profile } = await supabase!
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (!profile) throw new Error('Perfil de usuário não encontrado.');

        const { error } = await supabase!
          .from('fiado_payments')
          .insert({
            organization_id: profile.organization_id,
            client_id: clientId,
            amount: amountNum,
            payment_method: amortizeMethod
          });

        if (error) throw error;
      }

      setSuccessMsg(`Recebimento de ${amountNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado com sucesso!`);
      setAmortizeAmount('');
      
      // Delay closing modal so user sees success confirmation
      setTimeout(() => {
        setSelectedClient(null);
        setIsAmortizeModalOpen(false);
        setSuccessMsg(null);
        loadData();
      }, 1500);

    } catch (err: any) {
      console.error('Erro ao amortizar:', err);
      setErrorMsg(err.message || 'Erro ao registrar pagamento de fiado.');
    } finally {
      setAmortizeLoading(false);
    }
  };

  const getWhatsAppUrl = (name: string, contact: string, balance: number, limit: number) => {
    let cleanPhone = contact.replace(/\D/g, '');
    if (!cleanPhone) return '#';
    
    // Automatically prepend Brazil country code (55) if not present and number is Brazilian cell/phone
    if (cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
    }
    
    const message = `Olá, ${name}! Tudo bem? Passando para lembrar da sua ficha de fiado no BoxHub, que está em R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Limite de R$ ${limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). Quando você puder, dá uma passadinha para acertarmos. Obrigado!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // Filter and sort clients
  const filteredClients = clients
    .filter((c) => {
      // Only show clients with outstanding fiado balance
      if (c.balance <= 0) return false;

      // Text Filter
      const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Risk Filter
      if (riskFilter === 'todos') return matchesSearch;
      if (riskFilter === 'alto') return matchesSearch && c.usedPercent > 75;
      if (riskFilter === 'atencao') return matchesSearch && c.usedPercent >= 10 && c.usedPercent <= 75;
      if (riskFilter === 'saudavel') return matchesSearch && c.usedPercent < 10;
      
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'balance') return b.balance - a.balance;
      if (sortBy === 'usage') return b.usedPercent - a.usedPercent;
      return a.name.localeCompare(b.name);
    });

  // Find all clients exceeding their credit limits
  const exceededClients = clients.filter(c => c.balance > c.fiado_limit);

  if (loading) {
    return (
      <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 1. KPIs Section */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            <Coins size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Total a Receber</span>
            <span className={styles.kpiValue}>
              R$ {stats.totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <Users size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Fichas com Débito</span>
            <span className={styles.kpiValue}>
              {stats.devedoresCount} <span className={styles.kpiUnit}>clientes</span>
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Percent size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Limite Utilizado</span>
            <span className={styles.kpiValue}>
              {stats.limiteComprometido.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)' }}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Débito Médio</span>
            <span className={styles.kpiValue}>
              R$ {stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Exceeded Limits Alerts Area */}
      {exceededClients.length > 0 && (
        <div className={styles.alertsGrid}>
          {exceededClients.map((c) => (
            <div key={c.id} className={styles.alertItem}>
              <div className={styles.alertItemContent}>
                <AlertTriangle size={15} />
                <span>
                  <strong>{c.name}</strong> excedeu o limite de fiado: R$ {c.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / Limite de R$ {c.fiado_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {c.contact ? (
                <a 
                  href={getWhatsAppUrl(c.name, c.contact, c.balance, c.fiado_limit)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.alertActionLink}
                >
                  <MessageSquare size={13} />
                  <span>Cobrar no WhatsApp</span>
                </a>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sem telefone cadastrado</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Filters Section */}
      <div className={styles.filtersRow}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar por nome do cliente..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filterSelects}>
          <select 
            className={styles.selectInput}
            value={riskFilter}
            onChange={(e: any) => setRiskFilter(e.target.value)}
          >
            <option value="todos">Todos os Riscos</option>
            <option value="alto">Alto Risco (&gt;75% Limite)</option>
            <option value="atencao">Atenção (10% - 75%)</option>
            <option value="saudavel">Saudável / Em dia</option>
          </select>

          <select 
            className={styles.selectInput}
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
          >
            <option value="balance">Maior Saldo Devedor</option>
            <option value="usage">% Limite Usado</option>
            <option value="name">Nome do Cliente</option>
          </select>
        </div>
      </div>

      {/* 4. Client Debts Grid */}
      {filteredClients.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>Nenhum devedor encontrado</h3>
          <p>Não há clientes correspondentes aos filtros selecionados no momento.</p>
        </div>
      ) : (
        <div className={styles.debtGrid}>
          {filteredClients.map((c) => {
            const usedPercentClamped = Math.min(100, c.usedPercent);
            
            // Risk colors and labels config
            let riskClass = styles.riskHealthyBadge;
            let riskLabel = 'Saudável';
            let progressClass = styles.progressHealthy;

            if (c.balance > 0) {
              if (c.usedPercent > 75) {
                riskClass = styles.riskDangerBadge;
                riskLabel = 'Alto Risco';
                progressClass = styles.progressDanger;
              } else if (c.usedPercent >= 10) {
                riskClass = styles.riskWarningBadge;
                riskLabel = 'Atenção';
                progressClass = styles.progressWarning;
              }
            } else {
              riskLabel = 'Zerado';
            }

            const initials = c.name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

            return (
              <div key={c.id} className={styles.debtCard}>
                {/* Header: Avatar, Name and Estabelecimento Type */}
                <div className={styles.cardHeader}>
                  <div className={styles.clientAvatar}>
                    {initials || 'CL'}
                  </div>
                  <div className={styles.clientHeaderInfo}>
                    <span className={styles.clientName} title={c.name}>{c.name}</span>
                    <span className={styles.clientType}>
                      {c.type === 'quitanda' ? 'Quitanda / Sacolão' :
                       c.type === 'restaurante' ? 'Restaurante / Cozinha' :
                       c.type === 'mercado' ? 'Mercado / Minimercado' : 'Outro / Avulso'}
                    </span>
                  </div>
                </div>

                {/* Financial overview */}
                <div className={styles.financialInfo}>
                  <div className={styles.amountRow}>
                    <span className={styles.balanceLabel}>Ficha em Aberto</span>
                    <span className={styles.balanceValue} style={{ color: c.balance > 0 ? 'var(--text-main)' : 'var(--success)' }}>
                      R$ {c.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className={styles.progressContainer}>
                    <div className={styles.progressLabelRow}>
                      <span>Limite: R$ {c.fiado_limit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      <span>{c.usedPercent.toFixed(0)}% usado</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div 
                        className={`${styles.progressFill} ${progressClass}`} 
                        style={{ width: `${usedPercentClamped}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Last purchase and risk status badge */}
                <div className={styles.metaRow}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={12} />
                    Última compra: {c.lastSaleDate}
                  </span>
                  <span className={`${styles.riskBadge} ${riskClass}`}>
                    {riskLabel}
                  </span>
                </div>

                {/* Direct Action buttons */}
                <div className={styles.actionRow}>
                  {c.contact ? (
                    <a 
                      href={getWhatsAppUrl(c.name, c.contact, c.balance, c.fiado_limit)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.whatsappBtn}
                      title="Enviar cobrança via WhatsApp"
                    >
                      <MessageSquare size={14} />
                      <span>Cobrar</span>
                    </a>
                  ) : (
                    <button 
                      className={styles.whatsappBtn} 
                      disabled 
                      style={{ opacity: 0.4, cursor: 'not-allowed', background: 'var(--border-color)' }}
                      title="Cliente sem telefone registrado"
                    >
                      <MessageSquare size={14} />
                      <span>Sem fone</span>
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      setSelectedClient(c);
                      setIsAmortizeModalOpen(true);
                      setAmortizeAmount('');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={styles.amortizeBtn}
                    title="Registrar recebimento de fiado"
                  >
                    <DollarSign size={14} />
                    <span>Receber</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Amortization Quick Modal */}
      {isAmortizeModalOpen && selectedClient && (
        <div className={styles.modalOverlay} onClick={() => { if (!amortizeLoading) setSelectedClient(null); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                Registrar Recebimento
              </h3>
              <button 
                className={styles.closeBtn} 
                onClick={() => setSelectedClient(null)}
                disabled={amortizeLoading}
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="badge badge-danger" style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', display: 'block', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.5rem 0', textAlign: 'center' }}>
                <CheckCircle size={44} style={{ color: 'var(--success)' }} />
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>{successMsg}</p>
              </div>
            )}

            {!successMsg && (
              <form onSubmit={handleAmortizeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Cliente</p>
                  <p style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', margin: '0.15rem 0 0 0' }}>{selectedClient.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Fiado em aberto:</span>
                    <span style={{ color: 'var(--danger)', fontWeight: '600' }}>R$ {selectedClient.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Valor do Recebimento (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    max={selectedClient.balance}
                    className="form-control" 
                    placeholder="ex: 150.00"
                    required
                    value={amortizeAmount}
                    onChange={(e) => setAmortizeAmount(e.target.value)}
                    disabled={amortizeLoading}
                    style={{ fontSize: '0.9rem' }}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>Forma de Recebimento</label>
                  <select 
                    className="form-control"
                    value={amortizeMethod}
                    onChange={(e: any) => setAmortizeMethod(e.target.value)}
                    disabled={amortizeLoading}
                    style={{ fontSize: '0.9rem' }}
                  >
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ flex: 1, height: '38px', fontSize: '0.85rem' }} 
                    onClick={() => setSelectedClient(null)}
                    disabled={amortizeLoading}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ flex: 1, height: '38px', fontSize: '0.85rem' }} 
                    disabled={amortizeLoading || !amortizeAmount}
                  >
                    {amortizeLoading ? <span className="loading-spinner"></span> : 'Confirmar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
