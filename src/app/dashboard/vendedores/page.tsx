'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  Users, 
  TrendingUp, 
  ShoppingBag, 
  Coins, 
  ArrowLeft, 
  Search, 
  ChevronLeft, 
  Info,
  Calendar,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import SaleDetailModal from '@/components/SaleDetailModal';
import styles from './vendedores.module.css';

export default function VendedoresPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewingDetailMobile, setViewingDetailMobile] = useState(false);
  
  // Sale detail modal state
  const [selectedSaleForModal, setSelectedSaleForModal] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load logged-in user profile
      let profile = null;
      if (isMockMode) {
        profile = mockDb.getCurrentUser();
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (session) {
          const { data } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          profile = data;
        }
      }
      
      setCurrentUser(profile);

      // If user is not admin, we skip loading other team data
      if (profile && profile.role !== 'admin') {
        setLoading(false);
        return;
      }

      // 2. Load team, sales and clients
      let teamList: any[] = [];
      let salesList: any[] = [];
      let clientsList: any[] = [];

      if (isMockMode) {
        teamList = mockDb.profiles.list();
        salesList = mockDb.sales.list();
        clientsList = mockDb.clients.list();
      } else {
        const [profilesRes, salesRes, clientsRes] = await Promise.all([
          supabase!.from('profiles').select('*'),
          supabase!.from('sales').select('*, clients(name)').order('created_at', { ascending: false }),
          supabase!.from('clients').select('*')
        ]);
        teamList = profilesRes.data || [];
        salesList = salesRes.data || [];
        clientsList = clientsRes.data || [];
      }

      setVendedores(teamList);
      setSales(salesList);
      setClients(clientsList);

      if (teamList.length > 0 && !selectedSellerId) {
        setSelectedSellerId(teamList[0].id);
      }
    } catch (err) {
      console.error('Error loading Vendedores data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter sellers by search term
  const filteredVendedores = useMemo(() => {
    return vendedores.filter(v => 
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.role === 'admin' ? 'administrador' : 'vendedor').includes(searchTerm.toLowerCase())
    );
  }, [vendedores, searchTerm]);

  const selectedSeller = vendedores.find(v => v.id === selectedSellerId);

  // Calculate metrics for selected seller
  const sellerStats = useMemo(() => {
    if (!selectedSellerId) return { totalFaturamento: 0, totalSales: 0, ticketMedio: 0, fiadoPendente: 0, recentSales: [] };

    const activeSellerSales = sales.filter(s => s.seller_id === selectedSellerId);
    
    // Recent sales (sorted by newest, max 10)
    const recentSales = [...activeSellerSales]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const nonCanceledSales = activeSellerSales.filter(s => !s.is_canceled);

    const totalFaturamento = nonCanceledSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalSales = nonCanceledSales.length;
    const ticketMedio = totalSales > 0 ? totalFaturamento / totalSales : 0;
    
    const fiadoPendente = nonCanceledSales
      .filter(s => s.payment_method === 'fiado' && s.status === 'pendente')
      .reduce((sum, s) => sum + Number(s.total_amount), 0);

    return {
      totalFaturamento,
      totalSales,
      ticketMedio,
      fiadoPendente,
      recentSales
    };
  }, [sales, selectedSellerId]);

  if (loading) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Security Access Lock: Only Admin role can view team performance
  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className={styles.unauthorizedContainer}>
        <div className={`glass ${styles.unauthorizedCard}`}>
          <AlertTriangle size={48} className={styles.warningIcon} />
          <h2>Acesso não autorizado</h2>
          <p>
            Esta página é restrita a administradores. Vendedores não possuem autorização para visualizar o faturamento ou estatísticas da equipe da empresa.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1.2rem', marginTop: '0.5rem' }}>
            <ArrowLeft size={16} />
            <span>Voltar ao Painel</span>
          </Link>
        </div>
      </div>
    );
  }

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Venda Direta';
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.name : 'Cliente Deletado';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleSellerClick = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setViewingDetailMobile(true);
  };

  return (
    <div className={`${styles.container} ${viewingDetailMobile ? styles.showDetail : styles.showList}`}>
      <div className={styles.topRow}>
        
        {/* Coluna da Esquerda: Lista de Vendedores */}
        <div className={styles.leftCol}>
          <div className={`glass ${styles.listCard}`}>
            <div className={styles.listHeader}>
              <h3 className={styles.listTitle}>Equipe da Empresa</h3>
              <span className="badge" style={{ fontSize: '0.75rem' }}>{vendedores.length} membros</span>
            </div>

            <div className={styles.searchBar}>
              <Search className={styles.searchIcon} size={15} />
              <input
                type="text"
                placeholder="Buscar vendedor..."
                className="form-control"
                style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.825rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.sellerList}>
              {filteredVendedores.map(v => (
                <div
                  key={v.id}
                  onClick={() => handleSellerClick(v.id)}
                  className={`${styles.sellerItem} ${selectedSellerId === v.id ? styles.sellerItemActive : ''}`}
                >
                  <div className={styles.avatar}>
                    {v.avatar_url ? (
                      <img src={v.avatar_url} alt={v.name} className={styles.avatarImg} />
                    ) : (
                      getInitials(v.name)
                    )}
                  </div>
                  <div className={styles.sellerItemInfo}>
                    <div className={styles.nameRow}>
                      <span className={styles.sellerItemName}>{v.name}</span>
                    </div>
                    <span className={styles.sellerItemSub}>
                      {v.role === 'admin' ? 'Administrador' : 'Vendedor'}
                    </span>
                  </div>
                </div>
              ))}

              {filteredVendedores.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Nenhum vendedor encontrado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Painel de Detalhes e Métricas */}
        <div className={styles.rightCol}>
          {selectedSeller ? (
            <div className={`glass ${styles.detailCard}`}>
              
              {/* Botão de voltar (exclusivo mobile) */}
              <button 
                className={styles.backBtnMobile} 
                onClick={() => setViewingDetailMobile(false)}
              >
                <ChevronLeft size={16} />
                <span>Voltar para a lista</span>
              </button>

              <div className={styles.detailHeader}>
                <div className={styles.sellerProfileArea}>
                  <div className={styles.avatarLarge}>
                    {selectedSeller.avatar_url ? (
                      <img src={selectedSeller.avatar_url} alt={selectedSeller.name} className={styles.avatarImgLarge} />
                    ) : (
                      getInitials(selectedSeller.name)
                    )}
                  </div>
                  <div className={styles.sellerMeta}>
                    <div className={styles.sellerTitleRow}>
                      <h2 className={styles.sellerTitle}>{selectedSeller.name}</h2>
                      <span className={styles.roleLabel}>
                        {selectedSeller.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </div>
                    <div className={styles.contactInfo}>
                      <span>{selectedSeller.email || 'Sem e-mail cadastrado'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards de Métricas do Vendedor */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <TrendingUp className={styles.metricIcon} size={18} style={{ color: 'var(--success)' }} />
                  <span className={styles.metricLabel}>Faturamento</span>
                  <span className={styles.metricVal}>
                    {sellerStats.totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className={styles.metricCard}>
                  <ShoppingBag className={styles.metricIcon} size={18} style={{ color: 'var(--primary)' }} />
                  <span className={styles.metricLabel}>Vendas</span>
                  <span className={styles.metricVal}>{sellerStats.totalSales}</span>
                </div>

                <div className={styles.metricCard}>
                  <UserCheck className={styles.metricIcon} size={18} style={{ color: 'var(--text-muted)' }} />
                  <span className={styles.metricLabel}>Ticket Médio</span>
                  <span className={styles.metricVal}>
                    {sellerStats.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>

                <div className={`${styles.metricCard} ${sellerStats.fiadoPendente > 0 ? styles.alertState : ''}`}>
                  <Coins className={styles.metricIcon} size={18} style={{ color: sellerStats.fiadoPendente > 0 ? 'var(--danger)' : 'var(--text-muted)' }} />
                  <span className={styles.metricLabel}>Fiado Gerado</span>
                  <span className={styles.metricVal}>
                    {sellerStats.fiadoPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Histórico de Vendas Recentes do Vendedor */}
              <div className={styles.historySection}>
                <h4 className={styles.historyTitle}>
                  <ShoppingBag size={16} style={{ color: 'var(--primary)' }} />
                  <span>Vendas Recentes do Vendedor (Últimas 10)</span>
                </h4>

                {/* Tabela Desktop */}
                <div className={styles.historyTableWrapper}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Cliente</th>
                        <th>Método</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellerStats.recentSales.map(s => (
                        <tr 
                          key={s.id} 
                          onClick={() => setSelectedSaleForModal(s)}
                          className={`${styles.tableRowClickable} ${s.is_canceled ? styles.canceledRow : ''}`}
                        >
                          <td suppressHydrationWarning>
                            {new Date(s.created_at).toLocaleDateString('pt-BR')} {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 600 }}>{getClientName(s.client_id)}</td>
                          <td>
                            <span className={`badge ${s.payment_method === 'pix' ? 'badge-success' : s.payment_method === 'dinheiro' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                              {s.payment_method}
                            </span>
                          </td>
                          <td>
                            {s.is_canceled ? (
                              <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Cancelado</span>
                            ) : (
                              <span className={`badge ${s.status === 'pago' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                {s.status === 'pago' ? 'Pago' : 'Pendente'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: s.is_canceled ? 'inherit' : 'var(--text-main)' }}>
                            {Number(s.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      ))}

                      {sellerStats.recentSales.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                            Nenhuma venda registrada por este vendedor
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Lista Mobile */}
                <div className={styles.historyMobileList}>
                  {sellerStats.recentSales.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => setSelectedSaleForModal(s)}
                      className={`${styles.historyMobileCard} ${s.is_canceled ? styles.canceledMobileCard : ''}`}
                    >
                      <div className={styles.mobileCardHeader}>
                        <span className={styles.mobileClientName}>{getClientName(s.client_id)}</span>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <span className={`badge ${s.payment_method === 'pix' ? 'badge-success' : s.payment_method === 'dinheiro' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                            {s.payment_method}
                          </span>
                          {s.is_canceled && (
                            <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.65rem' }}>Cancelado</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.mobileCardFooter}>
                        <span className={styles.mobileDate} suppressHydrationWarning>
                          {new Date(s.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <span className={styles.mobileValue}>
                          {Number(s.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  ))}

                  {sellerStats.recentSales.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Nenhuma venda registrada por este vendedor
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.emptyDetails} glass`}>
              <Users size={48} style={{ color: 'var(--primary)', opacity: 0.4 }} />
              <div>
                <h3>Nenhum Vendedor Selecionado</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: 'var(--text-muted)', maxWidth: '360px' }}>
                  Selecione um vendedor na lista lateral para visualizar suas estatísticas de faturamento e histórico de vendas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sale details modal popup */}
      {selectedSaleForModal && (
        <SaleDetailModal 
          sale={selectedSaleForModal} 
          onClose={() => setSelectedSaleForModal(null)} 
          onSaleUpdated={loadData}
        />
      )}
    </div>
  );
}
