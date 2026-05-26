'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';

import { 
  Search, 
  ShoppingBag, 
  ChevronRight, 
  Calendar, 
  DollarSign, 
  CreditCard,
  X,
  Filter,
  ArrowUpDown,
  ArrowLeft
} from 'lucide-react';
import SaleDetailModal from '@/components/SaleDetailModal';
import styles from './vendas.module.css';

export default function VendasHistoryPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'val-desc' | 'val-asc'>('date-desc');

  // Detail Modal State
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Load Sales and Clients Data
  const loadData = async () => {
    setLoadingData(true);
    try {
      // Load current user profile first
      let userProfile = null;
      if (isMockMode) {
        userProfile = mockDb.getCurrentUser();
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (session) {
          const { data: profile } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          userProfile = profile;
        }
      }
      setCurrentUser(userProfile);

      let salesList: any[] = [];
      let clientsList: any[] = [];

      if (isMockMode) {
        // Mock DB loading
        salesList = mockDb.sales.list();
        clientsList = mockDb.clients.list();
      } else {
        // Supabase DB loading
        const { data: clientsData } = await supabase!.from('clients').select('*');
        const { data: salesData } = await supabase!
          .from('sales')
          .select('*, clients(name)')
          .order('created_at', { ascending: false });

        clientsList = clientsData || [];
        salesList = salesData || [];
      }

      // Filter sales for vendedores
      if (userProfile && userProfile.role === 'vendedor') {
        salesList = salesList.filter(s => s.seller_id === userProfile.id);
      }

      setClients(clientsList);
      setSales(salesList);
    } catch (err) {
      console.error('Error fetching sales history:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map client names helper
  const getClientName = (sale: any) => {
    if (isMockMode) {
      const client = clients.find(c => c.id === sale.client_id);
      return client ? client.name : 'Venda Direta';
    } else {
      return sale.clients?.name || 'Venda Direta';
    }
  };

  // Filter and Sort Sales List
  const filteredSales = useMemo(() => {
    let result = [...sales];

    // Filter by Client Name (search term)
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      result = result.filter(sale => {
        const clientName = getClientName(sale).toLowerCase();
        return clientName.includes(query);
      });
    }

    // Filter by Payment Method
    if (paymentMethod !== 'all') {
      result = result.filter(sale => sale.payment_method === paymentMethod);
    }

    // Filter by Status
    if (status !== 'all') {
      result = result.filter(sale => sale.status === status);
    }

    // Apply Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'val-desc') {
        return Number(b.total_amount) - Number(a.total_amount);
      }
      if (sortBy === 'val-asc') {
        return Number(a.total_amount) - Number(b.total_amount);
      }
      return 0;
    });

    return result;
  }, [sales, clients, searchTerm, paymentMethod, status, sortBy]);

  // Compute Filtered metrics
  const metrics = useMemo(() => {
    const activeSales = filteredSales.filter(s => !s.is_canceled);
    const totalCount = activeSales.length;
    const totalAmount = activeSales.reduce((acc, sale) => acc + Number(sale.total_amount), 0);
    const fiadoCount = activeSales.filter(s => s.payment_method === 'fiado').length;
    const fiadoPendenteAmount = activeSales
      .filter(s => s.payment_method === 'fiado' && s.status === 'pendente')
      .reduce((acc, sale) => acc + Number(sale.total_amount), 0);

    return {
      totalCount,
      totalAmount,
      fiadoCount,
      fiadoPendenteAmount
    };
  }, [filteredSales]);

  const clearFilters = () => {
    setSearchTerm('');
    setPaymentMethod('all');
    setStatus('all');
    setSortBy('date-desc');
  };

  const isFilterActive = searchTerm !== '' || paymentMethod !== 'all' || status !== 'all' || sortBy !== 'date-desc';

  if (loadingData) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Voltar ao Painel</span>
        </Link>
        <h1 className={styles.pageTitle}>Histórico de Vendas</h1>
      </div>

      {/* Metrics overview for current selection */}
      <div className={styles.metricsSummaryGrid}>
        <div className={`glass ${styles.summaryCard}`}>
          <div className={styles.summaryCardIcon}>
            <ShoppingBag size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div className={styles.summaryCardInfo}>
            <span className={styles.summaryCardLabel}>Vendas Filtradas</span>
            <span className={styles.summaryCardValue}>{metrics.totalCount}</span>
          </div>
        </div>

        <div className={`glass ${styles.summaryCard}`}>
          <div className={styles.summaryCardIcon} style={{ background: 'rgba(29, 158, 117, 0.1)' }}>
            <DollarSign size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div className={styles.summaryCardInfo}>
            <span className={styles.summaryCardLabel}>Total Faturado</span>
            <span className={styles.summaryCardValue}>
              {metrics.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className={`glass ${styles.summaryCard}`}>
          <div className={styles.summaryCardIcon} style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <CreditCard size={20} style={{ color: 'var(--danger)' }} />
          </div>
          <div className={styles.summaryCardInfo}>
            <span className={styles.summaryCardLabel}>Fiados Pendentes</span>
            <span className={styles.summaryCardValue}>
              {metrics.fiadoPendenteAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Box */}
      <div className={`glass ${styles.filtersCard}`}>
        <div className={styles.filtersHeader}>
          <div className={styles.filtersTitleGroup}>
            <Filter size={16} style={{ color: 'var(--primary)' }} />
            <h3 className={styles.filtersTitle}>Filtros e Pesquisa</h3>
          </div>
          {isFilterActive && (
            <button onClick={clearFilters} className={styles.clearFiltersBtn}>
              <X size={14} />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        <div className={styles.filtersGrid}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} size={18} />
            <input 
              type="text" 
              placeholder="Buscar por cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div className={styles.filterControl}>
            <select 
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="form-control"
            >
              <option value="all">Todas as Formas de Pagamento</option>
              <option value="pix">PIX</option>
              <option value="fiado">Fiado</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>

          <div className={styles.filterControl}>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="form-control"
            >
              <option value="all">Todos os Status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>

          <div className={styles.filterControl}>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="form-control"
            >
              <option value="date-desc">Mais Recentes Primeiro</option>
              <option value="date-asc">Mais Antigas Primeiro</option>
              <option value="val-desc">Maior Valor</option>
              <option value="val-asc">Menor Valor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main List Container */}
      <div className={`glass ${styles.listCard}`}>
        {filteredSales.length === 0 ? (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <h4>Nenhuma venda encontrada</h4>
            <p>Nenhuma venda corresponde aos critérios de busca selecionados.</p>
            {isFilterActive && (
              <button onClick={clearFilters} className="btn-secondary" style={{ marginTop: '1rem' }}>
                Limpar Todos os Filtros
              </button>
            )}
          </div>
        ) : (
          <div className={styles.salesTableWrapper}>
            {/* Desktop Table View */}
            <table className={styles.salesTable}>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Cliente</th>
                  <th>Forma Pagto.</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const clientName = getClientName(sale);
                  return (
                    <tr 
                      key={sale.id} 
                      onClick={() => setSelectedSale(sale)}
                      className={sale.is_canceled ? styles.canceledRow : ''}
                    >
                      <td className={styles.dateCell}>
                        <Calendar size={12} style={{ marginRight: '6px', opacity: 0.7 }} />
                        {new Date(sale.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{clientName}</td>
                      <td>
                        {sale.payment_method === 'fiado' && (
                          <span className="badge badge-danger">Fiado</span>
                        )}
                        {sale.payment_method === 'pix' && (
                          <span className="badge badge-success">PIX</span>
                        )}
                        {sale.payment_method === 'dinheiro' && (
                          <span className="badge badge-warning">Dinheiro</span>
                        )}
                      </td>
                      <td>
                        {sale.is_canceled ? (
                          <span className="badge badge-danger" style={{ opacity: 0.7 }}>Cancelada</span>
                        ) : (
                          <span className={`badge ${sale.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>
                            {sale.status === 'pago' ? 'Pago' : 'Pendente'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        {Number(sale.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards List */}
            <div className={styles.salesMobileList}>
              {filteredSales.map((sale) => {
                const clientName = getClientName(sale);
                return (
                  <div 
                    key={sale.id} 
                    className={`${styles.saleMobileCard} ${sale.is_canceled ? styles.canceledCard : ''}`}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className={styles.saleMobileCardHeader}>
                      <span className={styles.saleMobileCardClient}>{clientName}</span>
                      <span className={styles.saleMobileCardAmount}>
                        {Number(sale.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    
                    <div className={styles.saleMobileCardFooter}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {sale.payment_method === 'fiado' && (
                          <span className="badge badge-danger">Fiado</span>
                        )}
                        {sale.payment_method === 'pix' && (
                          <span className="badge badge-success">PIX</span>
                        )}
                        {sale.payment_method === 'dinheiro' && (
                          <span className="badge badge-warning">Dinheiro</span>
                        )}
                        {sale.is_canceled ? (
                          <span className="badge badge-danger" style={{ opacity: 0.7 }}>Cancelada</span>
                        ) : (
                          <span className={`badge ${sale.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>
                            {sale.status === 'pago' ? 'Pago' : 'Pendente'}
                          </span>
                        )}
                      </div>
                      <span className={styles.saleMobileCardDate}>
                        {new Date(sale.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <SaleDetailModal 
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onSaleUpdated={loadData}
        />
      )}
    </div>
  );
}
