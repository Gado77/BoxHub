'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Award, 
  ArrowLeft, 
  Calendar, 
  Package,
  TrendingDown,
  User,
  Users
} from 'lucide-react';
import styles from './relatorios.module.css';

export default function RelatoriosPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'all'>('7days');

  const loadData = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const salesList = mockDb.sales.list();
        const clientsList = mockDb.clients.list();
        const productsList = mockDb.products.list();
        const allVariants = mockStore.getVariants();
        const saleItems = mockStore.getSaleItems();
        const profilesList = mockDb.profiles.list();

        setSales(salesList);
        setClients(clientsList);
        setProfiles(profilesList);
        
        // Map sale items with names
        const activeSaleIds = new Set(salesList.filter(s => !s.is_canceled).map(s => s.id));
        const activeItems = saleItems.filter(item => activeSaleIds.has(item.sale_id));
        const mappedItems = activeItems.map(item => {
          const product = productsList.find(p => p.id === item.product_id);
          const variant = allVariants.find(v => v.id === item.variant_id);
          return {
            ...item,
            product_name: product ? product.name : 'Produto Desconhecido',
            product_type: product ? (product.type || 'fruta') : 'fruta',
            product_category: product ? (product.category || '') : '',
            variant_name: variant ? variant.name : ''
          };
        });
        setItems(mappedItems);
      } else {
        const { data: clientsData } = await supabase!.from('clients').select('*');
        const { data: profilesData } = await supabase!.from('profiles').select('*');
        const { data: salesData } = await supabase!
          .from('sales')
          .select('*, clients(name)')
          .order('created_at', { ascending: false });

        const activeSales = (salesData || []).filter(s => !s.is_canceled);
        const activeSaleIds = activeSales.map(s => s.id);

        let mappedItems: any[] = [];
        if (activeSaleIds.length > 0) {
          const { data: itemsData } = await supabase!
            .from('sale_items')
            .select('*, products(name, type, category), product_variants(name)')
            .in('sale_id', activeSaleIds);
          
          mappedItems = (itemsData || []).map(item => ({
            ...item,
            product_name: item.products?.name || 'Produto Desconhecido',
            product_type: item.products?.type || 'fruta',
            product_category: item.products?.category || '',
            variant_name: item.product_variants?.name || ''
          }));
        }

        setSales(salesData || []);
        setClients(clientsData || []);
        setProfiles(profilesData || []);
        setItems(mappedItems);
      }
    } catch (err) {
      console.error('Error loading reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter sales dynamically by timeRange
  const filteredSales = useMemo(() => {
    const activeSales = sales.filter(s => !s.is_canceled);
    if (timeRange === '7days') {
      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - 7);
      return activeSales.filter(s => new Date(s.created_at) >= cutOff);
    } else if (timeRange === '30days') {
      const cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - 30);
      return activeSales.filter(s => new Date(s.created_at) >= cutOff);
    }
    return activeSales;
  }, [sales, timeRange]);

  // Filter items corresponding to active sales
  const filteredItems = useMemo(() => {
    const activeSaleIds = new Set(filteredSales.map(s => s.id));
    return items.filter(item => activeSaleIds.has(item.sale_id));
  }, [items, filteredSales]);

  const stats = useMemo(() => {
    // Total Billing
    const totalBilling = filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    
    // Total sales count
    const salesCount = filteredSales.length;
    
    // Ticket Medio
    const averageTicket = salesCount > 0 ? totalBilling / salesCount : 0;
    
    // Total boxes sold
    const totalBoxes = filteredItems.reduce((sum, item) => sum + Number(item.quantity), 0);
    
    // Client map name helper
    const getClientNameById = (clientId: string | null) => {
      if (!clientId) return 'Venda Direta';
      const c = clients.find(cl => cl.id === clientId);
      return c ? c.name : 'Cliente Deletado';
    };

    // Client spends
    const clientSpendsMap: Record<string, { name: string, totalSpent: number, salesCount: number }> = {};
    filteredSales.forEach(s => {
      const name = getClientNameById(s.client_id);
      if (!clientSpendsMap[name]) {
        clientSpendsMap[name] = { name, totalSpent: 0, salesCount: 0 };
      }
      clientSpendsMap[name].totalSpent += Number(s.total_amount);
      clientSpendsMap[name].salesCount += 1;
    });

    const topClients = Object.values(clientSpendsMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Product quantities
    const productQtyMap: Record<string, number> = {};
    filteredItems.forEach(item => {
      const name = item.product_name + (item.variant_name ? ` (${item.variant_name})` : '');
      productQtyMap[name] = (productQtyMap[name] || 0) + Number(item.quantity);
    });

    const topProducts = Object.entries(productQtyMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Dynamic Daily Billing map based on selected range
    const numDays = timeRange === '7days' ? 7 : 30; // display max last 30 days for trend
    const dailyBillingMap: Record<string, number> = {};
    const dates = Array.from({ length: numDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    dates.forEach(d => {
      dailyBillingMap[d] = 0;
    });

    filteredSales.forEach(s => {
      const dateStr = s.created_at.split('T')[0];
      if (dateStr in dailyBillingMap) {
        dailyBillingMap[dateStr] += Number(s.total_amount);
      }
    });

    const chartData = dates.map(d => ({
      date: d,
      displayDate: d.split('-').slice(1).reverse().join('/'), // MM/DD -> DD/MM
      amount: dailyBillingMap[d]
    }));

    // Category Split (Frutas vs Legumes)
    let fruitBoxes = 0;
    let legumeBoxes = 0;
    filteredItems.forEach(item => {
      const qty = Number(item.quantity);
      if (item.product_type === 'legume') {
        legumeBoxes += qty;
      } else {
        fruitBoxes += qty;
      }
    });

    // Payment Methods Split
    let pixAmount = 0;
    let moneyAmount = 0;
    let fiadoAmount = 0;
    filteredSales.forEach(s => {
      const amt = Number(s.total_amount);
      if (s.payment_method === 'pix') pixAmount += amt;
      else if (s.payment_method === 'dinheiro') moneyAmount += amt;
      else if (s.payment_method === 'fiado') fiadoAmount += amt;
    });

    // Seller performance ranking
    const sellerSalesMap: Record<string, { name: string, role: string, avatarUrl: string | null, totalSold: number, salesCount: number }> = {};
    filteredSales.forEach(s => {
      const sellerId = s.seller_id;
      let sellerName = 'Administrador';
      let sellerRole = 'admin';
      let sellerAvatar = null;

      if (sellerId) {
        const p = profiles.find(prof => prof.id === sellerId);
        if (p) {
          sellerName = p.name;
          sellerRole = p.role === 'admin' ? 'Administrador' : 'Vendedor';
          sellerAvatar = p.avatar_url;
        }
      }

      if (!sellerSalesMap[sellerName]) {
        sellerSalesMap[sellerName] = { name: sellerName, role: sellerRole, avatarUrl: sellerAvatar, totalSold: 0, salesCount: 0 };
      }
      sellerSalesMap[sellerName].totalSold += Number(s.total_amount);
      sellerSalesMap[sellerName].salesCount += 1;
    });

    const topSellers = Object.values(sellerSalesMap)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5);

    return {
      totalBilling,
      salesCount,
      averageTicket,
      totalBoxes,
      topClients,
      topProducts,
      chartData,
      categorySplit: { fruitBoxes, legumeBoxes },
      payments: { pixAmount, moneyAmount, fiadoAmount },
      topSellers
    };
  }, [filteredSales, filteredItems, clients, profiles, timeRange]);

  // Points for native SVG Line Chart
  const lineChartPoints = useMemo(() => {
    const maxVal = Math.max(...stats.chartData.map(d => d.amount), 500);
    const len = stats.chartData.length;
    const points = stats.chartData.map((d, i) => ({
      x: 50 + (i * (395 / (len - 1))), // Scales horizontally dynamically
      y: 180 - (d.amount / maxVal * 140) // 180 is baseline, max height is 140
    }));

    let linePath = '';
    let areaPath = '';

    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} 180 L ${points[0].x} 180 Z`;
    }

    return {
      points,
      linePath,
      areaPath,
      maxVal
    };
  }, [stats.chartData]);

  // Max value for Bar Chart
  const maxBarQty = useMemo(() => {
    return Math.max(...stats.topProducts.map(p => p.qty), 1);
  }, [stats.topProducts]);

  if (loading) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const hasSales = sales.filter(s => !s.is_canceled).length > 0;

  // Calculate split values
  const totalCategoryBoxes = stats.categorySplit.fruitBoxes + stats.categorySplit.legumeBoxes;
  const fruitPercent = totalCategoryBoxes > 0 ? (stats.categorySplit.fruitBoxes / totalCategoryBoxes) * 100 : 50;
  const legumePercent = totalCategoryBoxes > 0 ? (stats.categorySplit.legumeBoxes / totalCategoryBoxes) * 100 : 50;

  const totalPayments = stats.payments.pixAmount + stats.payments.moneyAmount + stats.payments.fiadoAmount;
  const pixPercent = totalPayments > 0 ? (stats.payments.pixAmount / totalPayments) * 100 : 0;
  const moneyPercent = totalPayments > 0 ? (stats.payments.moneyAmount / totalPayments) * 100 : 0;
  const fiadoPercent = totalPayments > 0 ? (stats.payments.fiadoAmount / totalPayments) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
          <div>
            <Link href="/dashboard" className={styles.backLink}>
              <ArrowLeft size={16} />
              <span>Voltar ao Painel</span>
            </Link>
            <div className={styles.titleWrapper} style={{ marginTop: '0.25rem' }}>
              <h1 className={styles.pageTitle}>Relatórios e Estatísticas</h1>
              <span className={styles.subtitle}>Visão geral do desempenho e saúde do seu box</span>
            </div>
          </div>
          {/* Time range selector */}
          <div className={styles.rangeSelector}>
            <button 
              className={`${styles.rangeButton} ${timeRange === '7days' ? styles.rangeButtonActive : ''}`}
              onClick={() => setTimeRange('7days')}
            >
              7 Dias
            </button>
            <button 
              className={`${styles.rangeButton} ${timeRange === '30days' ? styles.rangeButtonActive : ''}`}
              onClick={() => setTimeRange('30days')}
            >
              30 Dias
            </button>
            <button 
              className={`${styles.rangeButton} ${timeRange === 'all' ? styles.rangeButtonActive : ''}`}
              onClick={() => setTimeRange('all')}
            >
              Todos
            </button>
          </div>
        </div>
      </div>

      {!hasSales ? (
        <div className={`glass ${styles.emptyState}`}>
          <TrendingUp size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3>Ainda não há dados suficientes</h3>
          <p>Registre algumas vendas para visualizar relatórios detalhados e gráficos de desempenho.</p>
          <Link href="/dashboard" className="btn-primary" style={{ marginTop: '1.25rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Ir para o Painel</span>
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className={styles.kpiGrid}>
            <div className={`glass ${styles.kpiCard}`}>
              <div className={styles.kpiIconWrapper} style={{ background: 'rgba(29, 158, 117, 0.1)' }}>
                <DollarSign size={20} style={{ color: 'var(--success)' }} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Faturamento do Período</span>
                <span className={styles.kpiValue}>
                  {stats.totalBilling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <div className={`glass ${styles.kpiCard}`}>
              <div className={styles.kpiIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                <TrendingUp size={20} style={{ color: '#3b82f6' }} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Ticket Médio</span>
                <span className={styles.kpiValue}>
                  {stats.averageTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>

            <div className={`glass ${styles.kpiCard}`}>
              <div className={styles.kpiIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                <Package size={20} style={{ color: '#f59e0b' }} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Caixas Vendidas</span>
                <span className={styles.kpiValue}>
                  {stats.totalBoxes} <span className={styles.kpiUnit}>caixas</span>
                </span>
              </div>
            </div>

            <div className={`glass ${styles.kpiCard}`}>
              <div className={styles.kpiIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.1)' }}>
                <ShoppingBag size={20} style={{ color: '#a855f7' }} />
              </div>
              <div className={styles.kpiInfo}>
                <span className={styles.kpiLabel}>Total de Vendas</span>
                <span className={styles.kpiValue}>
                  {stats.salesCount} <span className={styles.kpiUnit}>vendas</span>
                </span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className={styles.chartsGrid}>
            {/* Line Chart: Billing Trend */}
            <div className={`glass ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>
                  Evolução de Vendas ({timeRange === '7days' ? 'Últimos 7 dias' : timeRange === '30days' ? 'Últimos 30 dias' : 'Período Completo'})
                </h3>
                <span className={styles.chartLegend}>Faturamento diário em R$</span>
              </div>
              <div className={styles.svgContainer}>
                <svg viewBox="0 0 500 230" width="100%" height="100%" className={styles.svgChart}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35"/>
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="50" y1="40" x2="445" y2="40" stroke="var(--border-color)" strokeDasharray="3 3" />
                  <line x1="50" y1="110" x2="445" y2="110" stroke="var(--border-color)" strokeDasharray="3 3" />
                  <line x1="50" y1="180" x2="445" y2="180" stroke="var(--border-color)" />

                  {/* Area fill */}
                  {lineChartPoints.areaPath && (
                    <path d={lineChartPoints.areaPath} fill="url(#lineGrad)" />
                  )}

                  {/* Trend line */}
                  {lineChartPoints.linePath && (
                    <path 
                      d={lineChartPoints.linePath} 
                      fill="none" 
                      stroke="var(--primary)" 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                  )}

                  {/* Dots & Labels */}
                  {lineChartPoints.points.map((p, idx) => {
                    const amount = stats.chartData[idx].amount;
                    const len = stats.chartData.length;
                    const isPeak = amount === Math.max(...stats.chartData.map(d => d.amount));
                    // If length > 7, only show value for the peak/highest faturamento day to avoid crowding
                    const showValue = len <= 7 ? amount > 0 : (isPeak && amount > 0);
                    return (
                      <g key={idx}>
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r={len <= 7 ? "5" : "3.5"} 
                          fill="var(--bg-card)" 
                          stroke="var(--primary)" 
                          strokeWidth={len <= 7 ? "3" : "2"} 
                        />
                        {showValue && (
                          <text 
                            x={p.x} 
                            y={p.y - 12} 
                            textAnchor="middle" 
                            fontSize="9.5" 
                            fill="var(--text-main)" 
                            fontWeight="600"
                          >
                            {amount >= 1000 ? `R$ ${(amount / 1000).toFixed(1)}k` : `R$ ${amount.toFixed(0)}`}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {stats.chartData.map((d, idx) => {
                    const len = stats.chartData.length;
                    // If range is 30 days or more, only show labels every 5 days to avoid overlap
                    const showLabel = len <= 7 || idx === 0 || idx === len - 1 || idx % Math.ceil(len / 6) === 0;
                    if (!showLabel) return null;
                    return (
                      <text 
                        key={idx} 
                        x={50 + (idx * (395 / (len - 1)))} 
                        y="208" 
                        textAnchor="middle" 
                        fontSize="10" 
                        fill="var(--text-muted)"
                        fontWeight="500"
                      >
                        {d.displayDate}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Bar Chart: Top Products */}
            <div className={`glass ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Produtos Mais Vendidos</h3>
                <span className={styles.chartLegend}>Quantidade acumulada em caixas</span>
              </div>
              <div className={styles.svgContainer}>
                {stats.topProducts.length === 0 ? (
                  <div className={styles.noChartData}>Sem dados de produtos vendidos no período selecionado</div>
                ) : (
                  <svg viewBox="0 0 500 230" width="100%" height="100%" className={styles.svgChart}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--primary-alpha-30)" />
                        <stop offset="100%" stopColor="var(--primary)" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines vertical */}
                    <line x1="160" y1="15" x2="160" y2="200" stroke="var(--border-color)" />
                    <line x1="290" y1="15" x2="290" y2="200" stroke="var(--border-color)" strokeDasharray="3 3" />
                    <line x1="420" y1="15" x2="420" y2="200" stroke="var(--border-color)" strokeDasharray="3 3" />

                    {stats.topProducts.map((p, idx) => {
                      const barWidth = (p.qty / maxBarQty) * 260; // 260px is max length
                      const yPos = 25 + idx * 36;
                      return (
                        <g key={idx}>
                          {/* Label (Product name) */}
                          <text 
                            x="145" 
                            y={yPos + 13} 
                            textAnchor="end" 
                            fontSize="11.5" 
                            fill="var(--text-main)" 
                            fontWeight="500"
                            className={styles.productLabelText}
                          >
                            {p.name.length > 18 ? p.name.substring(0, 16) + '...' : p.name}
                          </text>

                          {/* Background shadow bar */}
                          <rect 
                            x="160" 
                            y={yPos} 
                            width="260" 
                            height="18" 
                            fill="rgba(255, 255, 255, 0.02)" 
                            rx="4" 
                          />

                          {/* Colored bar */}
                          <rect 
                            x="160" 
                            y={yPos} 
                            width={Math.max(barWidth, 6)} 
                            height="18" 
                            fill="url(#barGrad)" 
                            rx="4" 
                          />

                          {/* Value label */}
                          <text 
                            x={160 + barWidth + 10} 
                            y={yPos + 13} 
                            fontSize="11" 
                            fill="var(--text-muted)" 
                            fontWeight="600"
                          >
                            {p.qty} cx
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Distribution Grid (Categories & Payments) */}
          <div className={styles.distributionGrid}>
            {/* Category Split */}
            <div className={`glass ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Divisão de Categorias</h3>
                <span className={styles.chartLegend}>Proporção de vendas de Frutas vs Legumes</span>
              </div>
              <div className={styles.splitProgressContainer}>
                <div className={styles.splitProgressBar}>
                  <div className={styles.splitBarFrutas} style={{ width: `${fruitPercent}%` }} />
                  <div className={styles.splitBarLegumes} style={{ width: `${legumePercent}%` }} />
                </div>
                <div className={styles.splitStats}>
                  <div className={styles.splitStatItem}>
                    <div className={`${styles.splitColorDot} ${styles.splitColorDotFrutas}`} />
                    <div className={styles.splitStatText}>
                      <span className={styles.splitStatLabel}>Frutas</span>
                      <span className={styles.splitStatVal}>
                        {stats.categorySplit.fruitBoxes} cx <span className={styles.paymentMethodPercent}>({fruitPercent.toFixed(0)}%)</span>
                      </span>
                    </div>
                  </div>
                  <div className={styles.splitStatItem}>
                    <div className={`${styles.splitColorDot} ${styles.splitColorDotLegumes}`} />
                    <div className={styles.splitStatText}>
                      <span className={styles.splitStatLabel}>Legumes</span>
                      <span className={styles.splitStatVal}>
                        {stats.categorySplit.legumeBoxes} cx <span className={styles.paymentMethodPercent}>({legumePercent.toFixed(0)}%)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className={`glass ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Formas de Pagamento</h3>
                <span className={styles.chartLegend}>Distribuição física do faturamento</span>
              </div>
              <div className={styles.paymentBreakdownList} style={{ marginTop: '0.5rem' }}>
                {/* PIX */}
                <div className={styles.paymentBreakdownItem}>
                  <div className={styles.paymentBreakdownHeader}>
                    <span className={styles.paymentMethodName}>PIX</span>
                    <span className={styles.paymentMethodVal}>
                      {stats.payments.pixAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      <span className={styles.paymentMethodPercent}>({pixPercent.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className={styles.paymentProgressBar}>
                    <div className={`${styles.paymentProgressFill} ${styles.fillPix}`} style={{ width: `${pixPercent}%` }} />
                  </div>
                </div>

                {/* Dinheiro */}
                <div className={styles.paymentBreakdownItem}>
                  <div className={styles.paymentBreakdownHeader}>
                    <span className={styles.paymentMethodName}>Dinheiro</span>
                    <span className={styles.paymentMethodVal}>
                      {stats.payments.moneyAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      <span className={styles.paymentMethodPercent}>({moneyPercent.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className={styles.paymentProgressBar}>
                    <div className={`${styles.paymentProgressFill} ${styles.fillDinheiro}`} style={{ width: `${moneyPercent}%` }} />
                  </div>
                </div>

                {/* Fiado */}
                <div className={styles.paymentBreakdownItem}>
                  <div className={styles.paymentBreakdownHeader}>
                    <span className={styles.paymentMethodName}>Fiado</span>
                    <span className={styles.paymentMethodVal}>
                      {stats.payments.fiadoAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      <span className={styles.paymentMethodPercent}>({fiadoPercent.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className={styles.paymentProgressBar}>
                    <div className={`${styles.paymentProgressFill} ${styles.fillFiado}`} style={{ width: `${fiadoPercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rankings Grid (Clients & Sellers) */}
          <div className={styles.rankingsGrid}>
            {/* Top Clients Table */}
            <div className={`glass ${styles.rankingCard}`}>
              <div className={styles.rankingHeader}>
                <Award size={18} style={{ color: 'var(--primary)' }} />
                <h3 className={styles.rankingTitle}>Ranking de Clientes (Top 5 por Volume)</h3>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.rankingTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>Posição</th>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'center' }}>Compras</th>
                      <th style={{ textAlign: 'right' }}>Ticket Médio</th>
                      <th style={{ textAlign: 'right' }}>Total Comprado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topClients.map((c, idx) => {
                      const clientAverage = c.totalSpent / c.salesCount;
                      return (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`${styles.positionBadge} ${styles[`pos${idx + 1}`]}`}>
                              {idx + 1}º
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</td>
                          <td style={{ textAlign: 'center' }}>{c.salesCount} vendas</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {clientAverage.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                            {c.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                        </tr>
                      );
                    })}
                    {stats.topClients.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                          Nenhum cliente com compras registradas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Sellers Table */}
            <div className={`glass ${styles.rankingCard}`}>
              <div className={styles.rankingHeader}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                <h3 className={styles.rankingTitle}>Ranking de Vendedores (Desempenho da Equipe)</h3>
              </div>
              <div className={styles.tableWrapper}>
                <table className={styles.rankingTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px', textAlign: 'center' }}>Posição</th>
                      <th>Vendedor</th>
                      <th style={{ textAlign: 'center' }}>Vendas</th>
                      <th style={{ textAlign: 'right' }}>Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topSellers.map((s, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`${styles.positionBadge} ${styles[`pos${idx + 1}`]}`}>
                            {idx + 1}º
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div className={styles.sellerAvatar}>
                              {s.avatarUrl ? (
                                <img src={s.avatarUrl} alt={s.name} className={styles.sellerAvatarImg} />
                              ) : (
                                s.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</span>
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{s.role}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{s.salesCount}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                          {s.totalSold.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                    {stats.topSellers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                          Nenhum vendedor registrado neste período
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
