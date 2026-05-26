'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  TrendingUp, 
  AlertCircle, 
  Users, 
  ShoppingBag, 
  Plus, 
  Sparkles, 
  ChevronRight, 
  RefreshCw,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';
import NewSaleModal from '@/components/NewSaleModal';
import SaleDetailModal from '@/components/SaleDetailModal';
import styles from './page.module.css';

const parseInsightText = (text: string) => {
  // Remove emojis at start like ⚠️, 💸, 📈, ✨
  let cleanText = text.replace(/^[⚠️💸📈✨]\s*/, '');
  
  // Match the first bold match: **Something**
  const boldMatch = cleanText.match(/\*\*(.*?)\*\*/);
  
  if (boldMatch) {
    const title = boldMatch[1];
    // Description is the rest, replacing the bold tags with just the title or empty
    const description = cleanText.replace(/\*\*(.*?)\*\*/g, '').trim();
    return { title, description };
  }
  
  return { title: 'Dica do BoxHub', description: cleanText };
};

export default function DashboardPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    totalFiado: 0,
    activeClients: 0,
    todaySalesCount: 0
  });

  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Sale detail selection state
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      // 1. Get current user profile first
      let userProfile: any = null;
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

      // 2. Fetch lists based on mode
      let clientsList: any[] = [];
      let salesList: any[] = [];
      let activeFiadoSales: any[] = [];
      let activePayments: any[] = [];

      if (isMockMode) {
        clientsList = mockDb.clients.list();
        salesList = mockDb.sales.list();
        activeFiadoSales = salesList.filter(s => s.payment_method === 'fiado' && s.status === 'pendente');
        activePayments = mockStore.getFiadoPayments();
      } else {
        const [clientsRes, salesRes, fiadoSalesRes, paymentsRes] = await Promise.all([
          supabase!.from('clients').select('*'),
          supabase!.from('sales').select('*, clients(name)').order('created_at', { ascending: false }),
          supabase!.from('sales').select('client_id, seller_id, total_amount, is_canceled').eq('payment_method', 'fiado').eq('status', 'pendente'),
          supabase!.from('fiado_payments').select('client_id, amount')
        ]);

        clientsList = clientsRes.data || [];
        salesList = salesRes.data || [];
        activeFiadoSales = fiadoSalesRes.data || [];
        activePayments = paymentsRes.data || [];
      }

      // 3. Filter sales list for Vendedores (they only see their own sales)
      let displayedSales = [...salesList];
      if (userProfile && userProfile.role === 'vendedor') {
        displayedSales = displayedSales.filter(s => s.seller_id === userProfile.id);
      }

      // 4. Calculate stats
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySales = displayedSales.filter(s => s.created_at.startsWith(todayStr) && !s.is_canceled);
      const todayRevenue = todaySales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const todaySalesCount = todaySales.length;

      // Calculate total outstanding fiado
      let totalFiado = 0;
      if (userProfile && userProfile.role === 'vendedor') {
        // Proportional allocation of client outstanding debt to this seller
        const salesByClient: Record<string, any[]> = {};
        activeFiadoSales.filter((s: any) => !s.is_canceled).forEach((s: any) => {
          if (!salesByClient[s.client_id]) salesByClient[s.client_id] = [];
          salesByClient[s.client_id].push(s);
        });

        const paymentsByClient: Record<string, number> = {};
        activePayments.forEach((p: any) => {
          paymentsByClient[p.client_id] = (paymentsByClient[p.client_id] || 0) + Number(p.amount);
        });

        Object.entries(salesByClient).forEach(([clientId, clientSales]) => {
          const clientTotalDebt = clientSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
          const clientTotalPaid = paymentsByClient[clientId] || 0;
          const clientBalance = Math.max(0, clientTotalDebt - clientTotalPaid);

          if (clientBalance > 0) {
            const sellerSales = clientSales.filter((s) => s.seller_id === userProfile.id);
            const sellerDebt = sellerSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
            const sellerShare = clientTotalDebt > 0 ? sellerDebt / clientTotalDebt : 0;
            totalFiado += clientBalance * sellerShare;
          }
        });
      } else {
        // Admin: total fiado is sum of all non-canceled pending fiado sales minus all payments
        const totalDebt = activeFiadoSales
          .filter((s: any) => !s.is_canceled)
          .reduce((acc, curr) => acc + Number(curr.total_amount), 0);
        const totalPaid = activePayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
        totalFiado = Math.max(0, totalDebt - totalPaid);
      }

      setClients(clientsList);
      setSales(displayedSales);
      setMetrics({
        todayRevenue,
        totalFiado,
        activeClients: clientsList.length,
        todaySalesCount
      });

      // 5. Trigger insights loading with the filtered context
      await fetchAiInsights(userProfile, clientsList, displayedSales);

    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const handleOpenSaleModal = () => {
      setShowSaleModal(true);
    };
    window.addEventListener('open-new-sale-modal', handleOpenSaleModal);
    return () => {
      window.removeEventListener('open-new-sale-modal', handleOpenSaleModal);
    };
  }, []);

  const handleOpenSaleDetails = (sale: any) => {
    setSelectedSale(sale);
  };

  // AI insights generator based on current DB state (highly contextual rules)
  const generateRuleBasedInsights = (clientsList: any[], salesList: any[]) => {
    const insights = [];

    // 1. Identify client not buying in last 10 days
    const now = new Date();
    clientsList.forEach(client => {
      const lastPurchase = new Date(client.updated_at);
      const diffTime = Math.abs(now.getTime() - lastPurchase.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 10) {
        insights.push({
          type: 'warning',
          text: `⚠️ **${client.name}** não compra há ${diffDays} dias — a média dele é a cada 5 dias. Vale ligar!`
        });
      }
    });

    // 2. Heavy outstanding Fiado alert
    clientsList.forEach(client => {
      let balance = 0;
      if (isMockMode) {
        const totalBal = mockDb.fiado.getBalance(client.id);
        if (currentUser?.role === 'vendedor' && totalBal > 0) {
          const clientSales = mockDb.sales.list().filter(s => s.client_id === client.id && s.payment_method === 'fiado' && s.status === 'pendente' && !s.is_canceled);
          const sellerDebt = clientSales.filter(s => s.seller_id === currentUser.id).reduce((sum, s) => sum + Number(s.total_amount), 0);
          const totalDebt = clientSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
          balance = totalDebt > 0 ? totalBal * (sellerDebt / totalDebt) : 0;
        } else {
          balance = totalBal;
        }
      } else {
        const clientSales = salesList.filter(s => s.client_id === client.id && s.payment_method === 'fiado' && s.status === 'pendente' && !s.is_canceled);
        balance = clientSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      }

      if (balance > 500) {
        insights.push({
          type: 'danger',
          text: `💸 **${client.name}** está com R$ ${balance.toFixed(2)} em aberto no fiado. É o maior fiado da sua carteira.`
        });
      }
    });

    // 3. Best clients contribution
    if (salesList.length > 0) {
      // Group revenue by client
      const revenueByClient: Record<string, number> = {};
      let totalRevenue = 0;
      
      salesList.forEach(sale => {
        totalRevenue += Number(sale.total_amount);
        if (sale.client_id) {
          revenueByClient[sale.client_id] = (revenueByClient[sale.client_id] || 0) + Number(sale.total_amount);
        }
      });

      const clientTotals = Object.entries(revenueByClient)
        .map(([id, amount]) => ({
          name: clientsList.find(c => c.id === id)?.name || 'Vendas Diretas',
          amount
        }))
        .sort((a, b) => b.amount - a.amount);

      if (clientTotals.length > 0 && totalRevenue > 0) {
        const top1Contribution = (clientTotals[0].amount / totalRevenue) * 100;
        insights.push({
          type: 'success',
          text: `📈 **${clientTotals[0].name}** é seu melhor cliente. Ele representa ${top1Contribution.toFixed(0)}% do seu faturamento histórico.`
        });
      }
    }

    // Fallback default insight if empty
    if (insights.length === 0) {
      insights.push({
        type: 'success',
        text: `✨ Seus dados estão em dia! Registre vendas e fiados para colher insights analíticos sobre seus clientes do CEAGESP.`
      });
    }

    setAiInsights(insights.slice(0, 3));
  };

  const fetchAiInsights = async (userProfile?: any, currentClients?: any[], currentSales?: any[]) => {
    setLoadingInsights(true);
    try {
      const activeUser = (userProfile && typeof userProfile.role === 'string') ? userProfile : currentUser;
      const activeClients = Array.isArray(currentClients) ? currentClients : clients;
      const activeSales = Array.isArray(currentSales) ? currentSales : sales;

      if (isMockMode) {
        await new Promise(r => setTimeout(r, 800));
        generateRuleBasedInsights(activeClients, activeSales);
      } else {
        const sellerId = activeUser?.id || '';
        const role = activeUser?.role || '';
        const res = await fetch(`/api/ai/insights?seller_id=${sellerId}&role=${role}`);
        if (res.ok) {
          const data = await res.json();
          const loadedInsights = data.insights || [];
          setAiInsights(loadedInsights.slice(0, 3));
        } else {
          // If Claude integration fails, fallback to rules
          generateRuleBasedInsights(activeClients, activeSales);
        }
      }
    } catch {
      const activeClients = Array.isArray(currentClients) ? currentClients : clients;
      const activeSales = Array.isArray(currentSales) ? currentSales : sales;
      generateRuleBasedInsights(activeClients, activeSales);
    } finally {
      setLoadingInsights(false);
    }
  };

  if (loadingData) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardGrid}>
      {/* 1. Metrics Cards */}
      <div className={styles.metricsRow}>
        <div className={styles.metricCard}>
          <div className={`${styles.metricIconContainer} ${styles.metricRevenue}`}>
            <TrendingUp size={20} />
          </div>
          <div className={styles.metricDetails}>
            <span className={styles.metricLabel}>Faturamento de Hoje</span>
            <span className={styles.metricValue}>
              {metrics.todayRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={`${styles.metricIconContainer} ${styles.metricFiado}`}>
            <AlertTriangle size={20} />
          </div>
          <div className={styles.metricDetails}>
            <span className={styles.metricLabel}>Total Fiado Aberto</span>
            <span className={styles.metricValue}>
              {metrics.totalFiado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={`${styles.metricIconContainer} ${styles.metricClients}`}>
            <Users size={20} />
          </div>
          <div className={styles.metricDetails}>
            <span className={styles.metricLabel}>Clientes Cadastrados</span>
            <span className={styles.metricValue}>{metrics.activeClients}</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={`${styles.metricIconContainer} ${styles.metricSales}`}>
            <ShoppingBag size={20} />
          </div>
          <div className={styles.metricDetails}>
            <span className={styles.metricLabel}>Vendas de Hoje</span>
            <span className={styles.metricValue}>{metrics.todaySalesCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Main split page content */}
      <div className={styles.mainSplit}>
        {/* Left Column: Recent Sales logs */}
        <div className={`glass ${styles.salesContainer}`}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
              <span>Vendas Recentes</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mostrando as últimas {Math.min(3, sales.length)} vendas
            </span>
          </div>

          {sales.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhuma venda registrada ainda. Clique em "Registrar Venda" para começar!
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
                    <th style={{ textAlign: 'right' }}>Faturamento</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 3).map((sale) => {
                    const clientName = isMockMode 
                      ? (clients.find(c => c.id === sale.client_id)?.name || 'Venda Direta')
                      : (sale.clients?.name || 'Venda Direta');

                    return (
                      <tr 
                        key={sale.id} 
                        onClick={() => handleOpenSaleDetails(sale)}
                        className={sale.is_canceled ? styles.canceledRow : ''}
                      >
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(sale.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
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

              {/* Mobile Cards View */}
              <div className={styles.salesMobileList}>
                {sales.slice(0, 3).map((sale) => {
                  const clientName = isMockMode 
                    ? (clients.find(c => c.id === sale.client_id)?.name || 'Venda Direta')
                    : (sale.clients?.name || 'Venda Direta');

                  return (
                    <div 
                      key={sale.id} 
                      className={`${styles.saleMobileCard} ${sale.is_canceled ? styles.canceledCard : ''}`}
                      onClick={() => handleOpenSaleDetails(sale)}
                    >
                      <div className={styles.saleMobileCardHeader}>
                        <span className={styles.saleMobileCardClient}>{clientName}</span>
                        {sale.payment_method === 'fiado' && (
                          <span className="badge badge-danger">Fiado</span>
                        )}
                        {sale.payment_method === 'pix' && (
                          <span className="badge badge-success">PIX</span>
                        )}
                        {sale.payment_method === 'dinheiro' && (
                          <span className="badge badge-warning">Dinheiro</span>
                        )}
                      </div>
                      <div className={styles.saleMobileCardBody}>
                        <span className={styles.saleMobileCardDate}>
                          {new Date(sale.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className={styles.saleMobileCardAmount}>
                          {Number(sale.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Link to all sales */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <Link href="/dashboard/vendas" className="btn-secondary" style={{ fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
                  Ver Histórico Completo de Vendas
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Quick Actions & AI Insights */}
        <div className={styles.rightColumn}>
          
          {/* Quick Actions Panel */}
          <div className={`glass ${styles.quickActionsCard}`}>
            <div className={styles.cardHeader} style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <h3 className={styles.cardTitle} style={{ fontSize: '1rem' }}>Ações Rápidas</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowSaleModal(true)} 
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Plus size={18} />
                <span>Registrar Nova Venda</span>
              </button>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className={styles.aiInsightsCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 className={styles.aiHeading}>
                <Sparkles size={16} />
                <span>Central Inteligente de Decisões</span>
              </h3>
              <button 
                onClick={() => fetchAiInsights()} 
                className={styles.aiHeaderBtn}
                disabled={loadingInsights}
              >
                <RefreshCw size={12} className={loadingInsights ? 'loading-spinner' : ''} style={{ animation: loadingInsights ? 'spin 1s linear infinite' : 'none' }} />
                <span>Atualizar Análise</span>
              </button>
            </div>

            {loadingInsights ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '0.75rem' }}>
                <div className="loading-spinner" style={{ borderColor: 'rgba(29,158,117,0.2)', borderTopColor: 'var(--primary)' }}></div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Claude analisando o faturamento...</span>
              </div>
            ) : aiInsights.length === 0 ? (
              <div className={styles.aiEmptyState}>
                <Sparkles size={24} style={{ color: 'var(--primary)' }} />
                <span>Sem insights cadastrados. Clique em Atualizar Análise.</span>
              </div>
            ) : (
              <div className={styles.aiList}>
                {aiInsights.map((insight, idx) => {
                  const { title, description } = parseInsightText(insight.text);
                  let itemClass = styles.aiItem;
                  let icon = <AlertTriangle size={16} />;
                  
                  if (insight.type === 'danger') {
                    itemClass = `${styles.aiItem} ${styles.aiItemRisco}`;
                    icon = <AlertOctagon size={16} />;
                  } else if (insight.type === 'success') {
                    itemClass = `${styles.aiItem} ${styles.aiItemOportunidade}`;
                    icon = <TrendingUp size={16} />;
                  } else {
                    itemClass = `${styles.aiItem} ${styles.aiItemAlerta}`;
                    icon = <AlertTriangle size={16} />;
                  }

                  return (
                    <div key={idx} className={itemClass}>
                      <div className={styles.aiItemIconContainer}>
                        {icon}
                      </div>
                      <div className={styles.aiItemContent}>
                        <h4 className={styles.aiItemTitle}>{title}</h4>
                        <p className={styles.aiItemDesc}>{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className={styles.aiFooter}>
              Insights diários automáticos atualizados em tempo real.
            </div>
          </div>

        </div>
      </div>

      {/* 3. New Sale Modal Trigger */}
      {showSaleModal && (
        <NewSaleModal 
          onClose={() => setShowSaleModal(false)}
          onSaleCreated={loadDashboardData}
        />
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <SaleDetailModal 
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onSaleUpdated={loadDashboardData}
        />
      )}
    </div>
  );
}
