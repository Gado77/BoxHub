'use client';

import { useState, useEffect } from 'react';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  Users, 
  ChevronLeft,
  Search, 
  Plus, 
  Phone, 
  History, 
  Coins, 
  CreditCard, 
  CheckCircle,
  AlertTriangle,
  FileText,
  User,
  Store,
  Soup,
  ShoppingBag,
  TrendingUp,
  X,
  Edit,
  Award,
  Activity,
  DollarSign,
  Zap,
  Clock
} from 'lucide-react';
import styles from './clientes.module.css';

export default function ClientesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState<any | null>(null);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [clientFiadoBalance, setClientFiadoBalance] = useState(0);

  // Observations State (Saved in LocalStorage)
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [currentObsText, setCurrentObsText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'typing'>('saved');
  const [viewingDetailMobile, setViewingDetailMobile] = useState(false);

  // Modal Control States
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Amortization Form State
  const [amortizeAmount, setAmortizeAmount] = useState('');
  const [amortizeMethod, setAmortizeMethod] = useState<'dinheiro' | 'pix'>('pix');
  const [amortizeLoading, setAmortizeLoading] = useState(false);
  const [amortizeSuccess, setAmortizeSuccess] = useState(false);
  const [amortizeError, setAmortizeError] = useState<string | null>(null);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientType, setNewClientType] = useState<'quitanda' | 'restaurante' | 'mercado' | 'outro'>('outro');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientLimit, setNewClientLimit] = useState('1500');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Client Form State
  const [editClientName, setEditClientName] = useState('');
  const [editClientType, setEditClientType] = useState<'quitanda' | 'restaurante' | 'mercado' | 'outro'>('outro');
  const [editClientContact, setEditClientContact] = useState('');
  const [editClientLimit, setEditClientLimit] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load clients list
  const loadClients = async () => {
    if (isMockMode) {
      const data = mockDb.clients.list();
      setClients(data);
      if (data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    } else {
      const { data } = await supabase!.from('clients').select('*').order('name');
      const clientsList = data || [];
      setClients(clientsList);
      if (clientsList.length > 0 && !selectedClientId) {
        setSelectedClientId(clientsList[0].id);
      }
    }
  };

  useEffect(() => {
    loadClients();
    // Load observations from localStorage
    const savedObs = localStorage.getItem('boxhub_client_obs');
    if (savedObs) {
      try {
        setObservations(JSON.parse(savedObs));
      } catch (e) {
        console.error('Error loading observations:', e);
      }
    }
  }, []);

  // Fetch details when selected client changes
  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClientDetails(null);
      setSalesHistory([]);
      setClientFiadoBalance(0);
      setCurrentObsText('');
      setSaveStatus('saved');
      return;
    }

    const loadClientDetails = async () => {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;

      setSelectedClientDetails(client);
      setAmortizeSuccess(false);
      
      // Load current observations text
      const savedText = observations[selectedClientId] || '';
      setCurrentObsText(savedText);
      setSaveStatus('saved');

      if (isMockMode) {
        const history = mockDb.sales.list().filter(s => s.client_id === selectedClientId);
        setSalesHistory(history);
        setClientFiadoBalance(mockDb.fiado.getBalance(selectedClientId));
      } else {
        // Fetch client sales history
        const { data: history } = await supabase!
          .from('sales')
          .select('*')
          .eq('client_id', selectedClientId)
          .order('created_at', { ascending: false });
        
        setSalesHistory(history || []);

        // Calculate balance
        const { data: sales } = await supabase!
          .from('sales')
          .select('total_amount')
          .eq('client_id', selectedClientId)
          .eq('payment_method', 'fiado')
          .eq('status', 'pendente');

        const { data: payments } = await supabase!
          .from('fiado_payments')
          .select('amount')
          .eq('client_id', selectedClientId);

        const totalDebt = (sales || []).reduce((acc, curr) => acc + Number(curr.total_amount), 0);
        const totalPaid = (payments || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
        
        setClientFiadoBalance(Math.max(0, totalDebt - totalPaid));
      }
    };

    loadClientDetails();
  }, [selectedClientId, clients, observations]);

  // Handler for adding a new client
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      if (isMockMode) {
        const newClient = mockDb.clients.insert(
          newClientName,
          newClientType,
          newClientContact,
          Number(newClientLimit)
        );
        
        setClients(mockDb.clients.list());
        setSelectedClientId(newClient.id);
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;

        const { data, error } = await supabase!
          .from('clients')
          .insert({
            organization_id: orgId,
            name: newClientName,
            type: newClientType,
            contact: newClientContact,
            fiado_limit: Number(newClientLimit)
          })
          .select()
          .single();

        if (error) throw error;
        
        setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedClientId(data.id);
      }

      // Reset form & close
      setNewClientName('');
      setNewClientContact('');
      setNewClientLimit('1500');
      setShowNewModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar cliente.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Open Edit Modal and fill state
  const openEditModal = () => {
    if (!selectedClientDetails) return;
    setEditClientName(selectedClientDetails.name);
    setEditClientType(selectedClientDetails.type);
    setEditClientContact(selectedClientDetails.contact || '');
    setEditClientLimit(selectedClientDetails.fiado_limit.toString());
    setEditError(null);
    setShowEditModal(true);
  };

  // Handler for updating existing client
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !editClientName.trim()) return;

    setEditLoading(true);
    setEditError(null);

    try {
      if (isMockMode) {
        const all = mockStore.getClients();
        const updated = all.map(c => 
          c.id === selectedClientId 
            ? { 
                ...c, 
                name: editClientName, 
                type: editClientType, 
                contact: editClientContact, 
                fiado_limit: Number(editClientLimit),
                updated_at: new Date().toISOString() 
              } 
            : c
        );
        mockStore.saveClients(updated);
        
        // Reload locally
        const localClients = mockDb.clients.list();
        setClients(localClients);
        setSelectedClientDetails(localClients.find(c => c.id === selectedClientId));
      } else {
        const { error } = await supabase!
          .from('clients')
          .update({
            name: editClientName,
            type: editClientType,
            contact: editClientContact,
            fiado_limit: Number(editClientLimit),
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedClientId);

        if (error) throw error;
        
        await loadClients();
      }
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao atualizar cliente.');
    } finally {
      setEditLoading(false);
    }
  };

  // Handler for paying off fiado (Amortization)
  const handleAmortize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !amortizeAmount || Number(amortizeAmount) <= 0) return;

    const amountNum = parseFloat(amortizeAmount);
    const previousBalance = clientFiadoBalance;

    // Atualização Otimista imediata na UI
    setClientFiadoBalance(prev => Math.max(0, prev - amountNum));
    setAmortizeAmount('');
    setAmortizeSuccess(true);
    setAmortizeError(null);
    setAmortizeLoading(true);

    try {
      if (isMockMode) {
        mockDb.fiado.pay(selectedClientId, amountNum, amortizeMethod);
        await new Promise(r => setTimeout(r, 600));
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;

        const { error } = await supabase!
          .from('fiado_payments')
          .insert({
            organization_id: orgId,
            client_id: selectedClientId,
            amount: amountNum,
            payment_method: amortizeMethod
          });

        if (error) throw error;
      }
      
      // Reload lists and details in background to sync with real values
      loadClients();
    } catch (err: any) {
      console.error('Erro na amortização:', err);
      // Reverter estado otimista em caso de erro
      setClientFiadoBalance(previousBalance);
      setAmortizeSuccess(false);
      setAmortizeError(err.message || 'Erro ao processar pagamento. Tente novamente.');
    } finally {
      setAmortizeLoading(false);
    }
  };

  // Handler for text observations input change
  const handleObsChange = (text: string) => {
    setCurrentObsText(text);
    setSaveStatus('typing');
  };

  // Handler for saving client observations
  const handleSaveObservation = () => {
    if (!selectedClientId) return;
    const updatedObs = { ...observations, [selectedClientId]: currentObsText };
    setObservations(updatedObs);
    localStorage.setItem('boxhub_client_obs', JSON.stringify(updatedObs));
    setSaveStatus('saved');
    setAmortizeSuccess(true);
    setTimeout(() => setAmortizeSuccess(false), 2000);
  };

  // Filter clients list
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper: Get avatar initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Financial status logic
  const getClientFinancialHealth = (balance: number, limit: number) => {
    if (balance === 0) return { status: 'saudável', label: 'Saudável', class: styles.statusDotSaudavel };
    if (balance > limit * 0.75) return { status: 'inadimplente', label: 'Inadimplente', class: styles.statusDotRisco };
    return { status: 'atenção', label: 'Atenção', class: styles.statusDotAtencao };
  };

  // Analytics: average ticket calculation
  const getAverageTicket = () => {
    if (salesHistory.length === 0) return 0;
    const total = salesHistory.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
    return total / salesHistory.length;
  };

  // Analytics: last purchase text
  const getLastPurchaseDate = () => {
    if (salesHistory.length === 0) return 'Nenhuma';
    return new Date(salesHistory[0].created_at).toLocaleDateString('pt-BR');
  };

  // Analytics: frequency score text
  const getFrequencyText = () => {
    if (salesHistory.length < 2) return 'Estável';
    const dates = salesHistory.map(s => new Date(s.created_at).getTime()).sort();
    let sumDiff = 0;
    for (let i = 1; i < dates.length; i++) {
      sumDiff += dates[i] - dates[i-1];
    }
    const avgDays = Math.ceil(sumDiff / (dates.length - 1) / (1000 * 60 * 60 * 24));
    
    if (avgDays <= 3) return `A cada ${avgDays} dias`;
    if (avgDays <= 7) return `Semanal`;
    if (avgDays <= 15) return `Quinzenal`;
    return `Mensal`;
  };

  // Analytics: Credit Score letter
  const getCreditScore = (balance: number, limit: number) => {
    if (salesHistory.length === 0) return { score: 'N/A', class: styles.scoreB, label: 'Sem histórico' };
    const limitPercent = limit > 0 ? (balance / limit) * 100 : 0;
    
    if (balance === 0 && salesHistory.length >= 3) return { score: 'A+', class: styles.scoreA, label: 'Excelente' };
    if (limitPercent < 25) return { score: 'A', class: styles.scoreA, label: 'Bom score' };
    if (limitPercent < 50) return { score: 'B', class: styles.scoreB, label: 'Regular' };
    if (limitPercent < 75) return { score: 'C', class: styles.scoreC, label: 'Atenção' };
    return { score: 'D', class: styles.scoreD, label: 'Alto Risco' };
  };

  // Analytics: Total Movimentado
  const getTotalVolume = () => {
    return salesHistory.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
  };

  // Analytics: Total comprado no mês atual (Maio 2026)
  const getMonthTotal = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthSales = salesHistory.filter(sale => {
      const d = new Date(sale.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return monthSales.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
  };

  // Analytics: Nível do Cliente
  const getClientLevel = (totalVolume: number) => {
    if (totalVolume > 5000) return { title: 'Diamante', subtitle: 'VIP CEASA' };
    if (totalVolume > 2000) return { title: 'Ouro', subtitle: 'Frequente' };
    if (totalVolume > 500) return { title: 'Prata', subtitle: 'Varejo' };
    return { title: 'Bronze', subtitle: 'Novo Cliente' };
  };

  // Insights generation (verde, amarelo, azul, vermelho)
  const generateClientInsights = (balance: number, limit: number) => {
    const insights = [];
    const limitPercent = limit > 0 ? (balance / limit) * 100 : 0;

    if (limitPercent > 75) {
      insights.push({
        type: 'danger', // vermelho
        title: 'Risco Financeiro',
        text: 'Ficha de fiado muito próxima do limite. Considere suspender novas compras a prazo.',
        icon: <AlertTriangle size={15} />
      });
    } else if (limitPercent > 40) {
      insights.push({
        type: 'warning', // amarelo
        title: 'Atenção ao Limite',
        text: 'Uso de fiado intermediário. Mantenha acompanhamento para evitar travamento da ficha.',
        icon: <AlertTriangle size={15} />
      });
    }

    if (salesHistory.length >= 3 && getAverageTicket() > 500) {
      insights.push({
        type: 'opportunity', // azul
        title: 'Oportunidade',
        text: 'Cliente premium de alto faturamento. Ofereça vantagens e prioridade de estoque.',
        icon: <TrendingUp size={15} />
      });
    }

    // Inactivity warning (10 days)
    if (salesHistory.length > 0) {
      const lastSaleTime = new Date(salesHistory[0].created_at).getTime();
      const daysSinceLastSale = (Date.now() - lastSaleTime) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSale > 10) {
        insights.push({
          type: 'warning', // amarelo
          title: 'Atenção / Inativo',
          text: `Sem registrar novas caixas há ${Math.floor(daysSinceLastSale)} dias. Faça contato de retenção.`,
          icon: <Activity size={15} />
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: 'success', // verde
        title: 'Cliente Saudável',
        text: 'Crédito limpo e sem saldo devedor pendente. Histórico exemplar no Box.',
        icon: <CheckCircle size={15} />
      });
    }

    return insights;
  };

  const limitPercent = selectedClientDetails && selectedClientDetails.fiado_limit > 0
    ? (clientFiadoBalance / Number(selectedClientDetails.fiado_limit)) * 100
    : 0;

  const remainingLimit = selectedClientDetails
    ? Math.max(0, Number(selectedClientDetails.fiado_limit) - clientFiadoBalance)
    : 0;

  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  return (
    <div className={`${styles.container} ${viewingDetailMobile ? styles.showDetail : styles.showList}`}>
      
      {/* LINHA SUPERIOR: Lista de Clientes (esquerda) + Painel Principal (direita) */}
      <div className={styles.topRow}>
        
        {/* COLUNA 1: Lista de clientes */}
        <div className={styles.leftCol}>
          <div className={`${styles.listCard} glass`}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>
                Clientes ({filteredClients.length})
              </span>
              <button 
                className="btn-primary" 
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.25rem' }}
                onClick={() => {
                  setCreateError(null);
                  setShowNewModal(true);
                }}
              >
                <Plus size={14} />
                <span>Novo</span>
              </button>
            </div>

            <div className={styles.searchBar}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="form-control" 
                placeholder="Buscar por nome..." 
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '36px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.clientList}>
              {filteredClients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Nenhum cliente encontrado.
                </div>
              ) : (
                filteredClients.map(c => {
                  const balance = isMockMode 
                    ? mockDb.fiado.getBalance(c.id) 
                    : 0; 
                  
                  const health = getClientFinancialHealth(balance, Number(c.fiado_limit));

                  return (
                    <div 
                      key={c.id} 
                      className={`${styles.clientItem} ${selectedClientId === c.id ? styles.clientItemActive : ''}`}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        setViewingDetailMobile(true);
                      }}
                    >
                      <div className={styles.avatar}>
                        {getInitials(c.name)}
                      </div>
                      
                      <div className={styles.clientItemInfo}>
                        <div className={styles.nameRow}>
                          <span className={`${styles.statusDot} ${health.class}`} title={`Saúde: ${health.label}`} />
                          <span className={styles.clientItemName}>{c.name}</span>
                        </div>
                        <div className={styles.clientItemSub}>
                          {c.type.toUpperCase()} • {c.contact || 'Sem fone'}
                        </div>
                      </div>

                      {balance > 0 ? (
                        <span className={styles.debtBadge}>{balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>
                      ) : (
                        <span className={styles.noDebtBadge}>Em dia</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUNA 2: Painel Principal do Cliente */}
        {selectedClientDetails ? (
          <div className={styles.rightCol}>
            <div className={`${styles.detailCard} glass`}>
              
              {/* 1. Header do cliente */}
              <div className={styles.detailHeader}>
                <button 
                  onClick={() => setViewingDetailMobile(false)}
                  className={styles.backBtnMobile}
                  title="Voltar para a lista"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>

                <div className={styles.clientProfileArea}>
                  <div className={styles.avatarLarge}>
                    {getInitials(selectedClientDetails.name)}
                  </div>
                  <div className={styles.clientMeta}>
                    <div className={styles.clientTitleRow}>
                      <h2 className={styles.clientTitle}>{selectedClientDetails.name}</h2>
                      <span className={styles.clientTypeLabel}>
                        {selectedClientDetails.type}
                      </span>
                    </div>
                    <div className={styles.contactInfo}>
                      <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{selectedClientDetails.contact || 'Nenhum telefone registrado'}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.headerActions}>
                  {selectedClientDetails.contact && (
                    <a 
                      href={`https://wa.me/${selectedClientDetails.contact.replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.actionBtnWhatsapp}
                    >
                      <Phone size={13} />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  <button onClick={openEditModal} className={styles.actionBtnSecondary}>
                    <Edit size={13} />
                    <span>Editar</span>
                  </button>
                </div>
              </div>

              {/* 2. Cards financeiros */}
              <div className={styles.financialSection}>
                <div className={styles.fiadoInfoGrid}>
                  <div className={`${styles.fiadoMetric} ${clientFiadoBalance > 0 ? styles.fiadoAlertState : ''}`}>
                    <Coins className={styles.fiadoMetricIcon} size={18} />
                    <span className={styles.fiadoMetricLabel}>Fiado em Aberto</span>
                    <span 
                      className={styles.fiadoMetricVal} 
                      style={{ color: clientFiadoBalance > 0 ? 'var(--danger)' : 'var(--success)' }}
                    >
                      R$ {clientFiadoBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  <div className={styles.fiadoMetric}>
                    <CreditCard className={styles.fiadoMetricIcon} size={18} />
                    <span className={styles.fiadoMetricLabel}>Limite Máximo</span>
                    <span className={styles.fiadoMetricVal}>
                      R$ {Number(selectedClientDetails.fiado_limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className={styles.fiadoMetric}>
                    <Coins className={styles.fiadoMetricIcon} size={18} />
                    <span className={styles.fiadoMetricLabel}>Ficha Restante</span>
                    <span className={styles.fiadoMetricVal} style={{ color: 'var(--primary)' }}>
                      R$ {remainingLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* 3. Barra de crédito disponível */}
                <div className={styles.progressBarContainer}>
                  <div className={styles.progressBarLabelRow}>
                    <span>Crédito em uso: {limitPercent.toFixed(0)}%</span>
                    <span>Limite Disponível: {remainingLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className={styles.progressBarTrack}>
                    <div 
                      className={styles.progressBarFill}
                      style={{
                        width: `${Math.min(100, limitPercent)}%`,
                        backgroundColor: limitPercent > 75 ? 'var(--danger)' : limitPercent > 30 ? 'var(--warning)' : 'var(--success)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Área de amortização */}
              <div className={styles.amortizeSection}>
                <h4 className={styles.amortizeHeader}>
                  <Coins className={styles.amortizeHeaderIcon} size={16} />
                  <span>Amortizar Saldo Devedor</span>
                </h4>
                
                {amortizeSuccess && (
                  <div className="badge badge-success" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                    <CheckCircle size={16} />
                    <span>Transação concluída com sucesso!</span>
                  </div>
                )}

                {amortizeError && (
                  <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>{amortizeError}</span>
                  </div>
                )}

                <form onSubmit={handleAmortize} className={styles.amortizeForm}>
                  <div className={styles.formInputGroup}>
                    <label className="form-label">Valor Recebido (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className={styles.inputControl}
                      placeholder="R$ 0,00"
                      required
                      value={amortizeAmount}
                      onChange={(e) => setAmortizeAmount(e.target.value)}
                    />
                  </div>
                  
                  <div className={styles.formInputGroup}>
                    <label className="form-label">Forma de Pagamento</label>
                    <select 
                      className={styles.inputControl}
                      value={amortizeMethod}
                      onChange={(e: any) => setAmortizeMethod(e.target.value)}
                    >
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro em Espécie</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className={styles.btnSubmit}
                    disabled={amortizeLoading || clientFiadoBalance === 0}
                  >
                    {amortizeLoading ? <span className="loading-spinner"></span> : 'Amortizar'}
                  </button>
                </form>
              </div>

              {/* 5. Histórico recente de compras */}
              <div className={styles.historySection}>
                <h4 className={styles.historyTitle}>
                  Histórico Recente de Compras
                </h4>

                {salesHistory.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    Nenhuma compra registrada para este cliente.
                  </div>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className={styles.historyTableWrapper}>
                      <table className={styles.historyTable}>
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Forma de Pagamento</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Valor Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesHistory.slice(0, 5).map(sale => (
                            <tr key={sale.id}>
                              <td style={{ color: 'var(--text-muted)' }}>
                                {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                              </td>
                              <td>
                                {sale.payment_method === 'fiado' && (
                                  <span className="badge badge-danger">Fiado</span>
                                )}
                                {sale.payment_method === 'pix' && (
                                  <span className="badge badge-success">PIX</span>
                                )}
                                {sale.payment_method === 'dinheiro' && (
                                  <span className="badge badge-warning" style={{ color: 'var(--text-dark)' }}>Dinheiro</span>
                                )}
                              </td>
                              <td>
                                {sale.status === 'pago' ? (
                                  <span style={{ color: 'var(--success)' }}>✓ Pago</span>
                                ) : (
                                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Pendente</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                R$ {Number(sale.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View */}
                    <div className={styles.historyMobileList}>
                      {salesHistory.slice(0, 5).map(sale => (
                        <div key={sale.id} className={styles.historyMobileCard}>
                          <div className={styles.historyMobileRow}>
                            <span className={styles.historyMobileDate}>
                              {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <span className={styles.historyMobileAmount}>
                              R$ {Number(sale.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className={styles.historyMobileRow}>
                            <div>
                              {sale.payment_method === 'fiado' && (
                                <span className="badge badge-danger">Fiado</span>
                              )}
                              {sale.payment_method === 'pix' && (
                                <span className="badge badge-success">PIX</span>
                              )}
                              {sale.payment_method === 'dinheiro' && (
                                <span className="badge badge-warning" style={{ color: 'var(--text-dark)' }}>Dinheiro</span>
                              )}
                            </div>
                            <span className={sale.status === 'pago' ? styles.statusPaid : styles.statusPending}>
                              {sale.status === 'pago' ? '✓ Pago' : 'Pendente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        ) : (
          /* EMPTY STATE (takes the right column area) */
          <div className={`${styles.emptyDetails} glass`}>
            <Users size={48} style={{ color: 'var(--primary)', opacity: 0.4 }} />
            <div>
              <h3>Nenhum Cliente Selecionado</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: 'var(--text-muted)', maxWidth: '360px' }}>
                Selecione um cliente no diretório lateral para abrir a central de limite, amortização, histórico e insights financeiros.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ABAIXO DISSO (OCUPANDO TODA A LARGURA DA TELA) */}
      {selectedClientDetails && (
        <div className={styles.bottomRow}>
          
          {/* 6. Perfil de Faturamento */}
          <div className={`${styles.profileCard} glass`}>
            <h4 className={styles.widgetTitle}>
              <Award size={16} />
              <span>Perfil Financeiro & Hábitos de Crédito</span>
            </h4>
            <div className={styles.profileGrid}>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Score de Crédito</span>
                <span className={styles.profileMetricVal}>
                  {getCreditScore(clientFiadoBalance, Number(selectedClientDetails.fiado_limit)).score}
                </span>
                <span className={styles.profileMetricSub}>
                  {getCreditScore(clientFiadoBalance, Number(selectedClientDetails.fiado_limit)).label}
                </span>
              </div>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Ticket Médio</span>
                <span className={styles.profileMetricVal}>
                  R$ {getAverageTicket().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={styles.profileMetricSub}>Média por compra</span>
              </div>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Última Compra</span>
                <span className={styles.profileMetricVal}>{getLastPurchaseDate()}</span>
                <span className={styles.profileMetricSub}>Ficha de registro</span>
              </div>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Frequência</span>
                <span className={styles.profileMetricVal}>{getFrequencyText()}</span>
                <span className={styles.profileMetricSub}>Hábitos de compras</span>
              </div>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Total no Mês</span>
                <span className={styles.profileMetricVal}>
                  R$ {getMonthTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className={styles.profileMetricSub}>Volume em {capitalizedMonth}</span>
              </div>
              <div className={styles.profileMetric}>
                <span className={styles.profileMetricLabel}>Tendência de Compras</span>
                <div className={styles.miniChartContainer}>
                  <svg viewBox="0 0 100 30" className={styles.miniChartSvg}>
                    <path
                      d="M0,25 C15,10 30,30 45,5 C60,25 75,10 100,5"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,25 C15,10 30,30 45,5 C60,25 75,10 100,5 L100,30 L0,30 Z"
                      fill="url(#gradient-chart)"
                      opacity="0.15"
                    />
                    <defs>
                      <linearGradient id="gradient-chart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <span className={styles.profileMetricSub}>Últimos 30 dias</span>
              </div>
            </div>
          </div>

          {/* 7. Insights de Crédito (IA) */}
          <div className={`${styles.insightsCard} glass`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.25rem' }}>
              <h4 className={styles.widgetTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <TrendingUp size={16} />
                <span>Insights de Crédito (IA)</span>
              </h4>
              <button className={styles.actionBtnSecondary} style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem' }}>
                Ver todos insights
              </button>
            </div>
            
            <div className={styles.insightsGrid}>
              {generateClientInsights(clientFiadoBalance, Number(selectedClientDetails.fiado_limit)).map((insight, idx) => {
                let cardClass = styles.insightSuccess;
                if (insight.type === 'warning') cardClass = styles.insightWarning;
                if (insight.type === 'danger') cardClass = styles.insightDanger;
                if (insight.type === 'opportunity') cardClass = styles.insightOpportunity;

                return (
                  <div key={idx} className={`${styles.insightMiniCard} ${cardClass}`}>
                    <div className={styles.insightIcon}>{insight.icon}</div>
                    <div className={styles.insightContent}>
                      <span className={styles.insightTitle}>{insight.title}</span>
                      <span className={styles.insightDesc}>{insight.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8. Observações Internas */}
          <div className={`${styles.obsCard} glass`}>
            <h4 className={styles.widgetTitle}>
              <FileText size={16} />
              <span>Observações Internas & Notas de Entrega</span>
            </h4>
            <textarea 
              className={styles.obsTextarea}
              placeholder="Ex: Prefere entregas no período da manhã. Costuma amortizar em PIX às terças-feiras..."
              value={currentObsText}
              onChange={(e) => handleObsChange(e.target.value)}
            />
            <div className={styles.obsFooter}>
              <div className={styles.obsMeta}>
                <span>{currentObsText.length} caracteres</span>
                {saveStatus === 'typing' ? (
                  <span className={`${styles.autosaveStatus} ${styles.statusTyping}`}>
                    ● Alterações pendentes
                  </span>
                ) : (
                  <span className={`${styles.autosaveStatus} ${styles.statusSaved}`}>
                    ✓ Salvo no navegador
                  </span>
                )}
              </div>
              <button 
                onClick={handleSaveObservation}
                className={styles.btnSaveObs}
              >
                Salvar Nota
              </button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL: NEW CLIENT */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                <span>Novo Cliente</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="badge badge-danger" style={{ width: '100%' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label">Nome Fantasia / Nome Completo</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: Quitanda do Hortifruti"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Estabelecimento</label>
                <select 
                  className="form-control"
                  value={newClientType}
                  onChange={(e: any) => setNewClientType(e.target.value)}
                >
                  <option value="quitanda">Quitanda / Sacolão</option>
                  <option value="restaurante">Restaurante / Cozinha</option>
                  <option value="mercado">Mercado / Minimercado</option>
                  <option value="outro">Outro / Avulso</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Limite Ficha de Fiado (R$)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="1500"
                  required
                  value={newClientLimit}
                  onChange={(e) => setNewClientLimit(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: (11) 99999-8888"
                  value={newClientContact}
                  onChange={(e) => setNewClientContact(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn-secondary" style={{ height: '38px' }} onClick={() => setShowNewModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ height: '38px' }} disabled={createLoading}>
                  {createLoading ? <span className="loading-spinner"></span> : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT CLIENT */}
      {showEditModal && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Edit size={18} style={{ color: 'var(--primary)' }} />
                <span>Editar Informações do Cliente</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="badge badge-danger" style={{ width: '100%' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateClient} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label">Nome Fantasia / Nome Completo</label>
                <input 
                  type="text" 
                  className="form-control" 
                  required
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Estabelecimento</label>
                <select 
                  className="form-control"
                  value={editClientType}
                  onChange={(e: any) => setEditClientType(e.target.value)}
                >
                  <option value="quitanda">Quitanda / Sacolão</option>
                  <option value="restaurante">Restaurante / Cozinha</option>
                  <option value="mercado">Mercado / Minimercado</option>
                  <option value="outro">Outro / Avulso</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Limite Ficha de Fiado (R$)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  required
                  value={editClientLimit}
                  onChange={(e) => setEditClientLimit(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Telefone / WhatsApp</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editClientContact}
                  onChange={(e) => setEditClientContact(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className="btn-secondary" style={{ height: '38px' }} onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ height: '38px' }} disabled={editLoading}>
                  {editLoading ? <span className="loading-spinner"></span> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
