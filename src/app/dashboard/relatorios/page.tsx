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
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7days' | 'all'>('7days');

  const loadData = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const salesList = mockDb.sales.list();
        const clientsList = mockDb.clients.list();
        const productsList = mockDb.products.list();
        const allVariants = mockStore.getVariants();
        const saleItems = mockStore.getSaleItems();

        setSales(salesList);
        setClients(clientsList);
        
        // Map sale items with names
        const activeSaleIds = new Set(salesList.filter(s => !s.is_canceled).map(s => s.id));
        const activeItems = saleItems.filter(item => activeSaleIds.has(item.sale_id));
        const mappedItems = activeItems.map(item => {
          const product = productsList.find(p => p.id === item.product_id);
          const variant = allVariants.find(v => v.id === item.variant_id);
          return {
            ...item,
            product_name: product ? product.name : 'Produto Desconhecido',
            variant_name: variant ? variant.name : ''
          };
        });
        setItems(mappedItems);
      } else {
        const { data: clientsData } = await supabase!.from('clients').select('*');
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
            .select('*, products(name), variants(name)')
            .in('sale_id', activeSaleIds);
          
          mappedItems = (itemsData || []).map(item => ({
            ...item,
            product_name: item.products?.name || 'Produto Desconhecido',
            variant_name: item.variants?.name || ''
          }));
        }

        setSales(salesData || []);
        setClients(clientsData || []);
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

  const stats = useMemo(() => {
    const activeSales = sales.filter(s => !s.is_canceled);
    
    // Total Billing
    const totalBilling = activeSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    
    // Total sales count
    const salesCount = activeSales.length;
    
    // Ticket Medio
    const averageTicket = salesCount > 0 ? totalBilling / salesCount : 0;
    
    // Total boxes sold
    const totalBoxes = items.reduce((sum, item) => sum + Number(item.quantity), 0);
    
    // Client map name helper
    const getClientNameById = (clientId: string | null) => {
      if (!clientId) return 'Venda Direta';
      const c = clients.find(cl => cl.id === clientId);
      return c ? c.name : 'Cliente Deletado';
    };

    // Client spends
    const clientSpendsMap: Record<string, { name: string, totalSpent: number, salesCount: number }> = {};
    activeSales.forEach(s => {
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
    items.forEach(item => {
      const name = item.product_name + (item.variant_name ? ` (${item.variant_name})` : '');
      productQtyMap[name] = (productQtyMap[name] || 0) + Number(item.quantity);
    });

    const topProducts = Object.entries(productQtyMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Daily Billing (last 7 days)
    const dailyBillingMap: Record<string, number> = {};
    // Seed last 7 days with 0
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    dates.forEach(d => {
      dailyBillingMap[d] = 0;
    });

    activeSales.forEach(s => {
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

    return {
      totalBilling,
      salesCount,
      averageTicket,
      totalBoxes,
      topClients,
      topProducts,
      chartData
    };
  }, [sales, clients, items]);

  // Points for native SVG Line Chart
  const lineChartPoints = useMemo(() => {
    const maxVal = Math.max(...stats.chartData.map(d => d.amount), 500);
    const points = stats.chartData.map((d, i) => ({
      x: 50 + (i * 65), // Scales horizontally across 450px
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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Voltar ao Painel</span>
        </Link>
        <div className={styles.titleWrapper}>
          <h1 className={styles.pageTitle}>Relatórios e Estatísticas</h1>
          <span className={styles.subtitle}>Visão geral do desempenho e saúde do seu box</span>
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
                <span className={styles.kpiLabel}>Faturamento Total</span>
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
                <h3 className={styles.chartTitle}>Evolução de Vendas (Últimos 7 dias)</h3>
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
                    return (
                      <g key={idx}>
                        <circle 
                          cx={p.x} 
                          cy={p.y} 
                          r="5" 
                          fill="var(--bg-card)" 
                          stroke="var(--primary)" 
                          strokeWidth="3" 
                        />
                        {amount > 0 && (
                          <text 
                            x={p.x} 
                            y={p.y - 12} 
                            textAnchor="middle" 
                            fontSize="10" 
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
                  {stats.chartData.map((d, idx) => (
                    <text 
                      key={idx} 
                      x={50 + (idx * 65)} 
                      y="208" 
                      textAnchor="middle" 
                      fontSize="10.5" 
                      fill="var(--text-muted)"
                      fontWeight="500"
                    >
                      {d.displayDate}
                    </text>
                  ))}
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
                  <div className={styles.noChartData}>Sem dados de produtos vendidos</div>
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

          {/* Ranking Row */}
          <div className={`glass ${styles.rankingCard}`}>
            <div className={styles.rankingHeader}>
              <Award size={18} style={{ color: 'var(--primary)' }} />
              <h3 className={styles.rankingTitle}>Ranking de Clientes (Top 5 por Volume Financeiro)</h3>
            </div>
            
            <div className={styles.tableWrapper}>
              <table className={styles.rankingTable}>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center' }}>Posição</th>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'center' }}>Qtd. de Compras</th>
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
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
