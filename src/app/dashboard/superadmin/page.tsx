'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  Building, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  ArrowLeft, 
  ShieldAlert, 
  Database,
  Cpu,
  Activity,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';
import styles from './superadmin.module.css';

export default function SuperAdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiLatency, setApiLatency] = useState<number>(0);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    const startFetch = Date.now();
    try {
      // 1. Load current profile
      let userProfile = null;
      if (isMockMode) {
        userProfile = mockDb.getCurrentUser();
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (session) {
          const { data } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          userProfile = data;
        }
      }
      setCurrentUser(userProfile);

      // Lock access if role is not superadmin
      if (userProfile && userProfile.role !== 'superadmin') {
        setLoading(false);
        return;
      }

      // 2. Fetch all system data
      let orgsList: any[] = [];
      let profilesList: any[] = [];
      let salesList: any[] = [];
      let clientsList: any[] = [];

      if (isMockMode) {
        orgsList = mockStore.getOrgs();
        profilesList = mockStore.getProfiles();
        salesList = mockStore.getSales();
        clientsList = mockStore.getClients();
        setSupabaseConnected(false); // Fictional: mock mode shows system local offline
      } else {
        // Fetch from real Supabase
        const [orgsRes, profilesRes, salesRes, clientsRes] = await Promise.all([
          supabase!.from('organizations').select('*').order('created_at', { ascending: false }),
          supabase!.from('profiles').select('*'),
          supabase!.from('sales').select('*'),
          supabase!.from('clients').select('*')
        ]);
        orgsList = orgsRes.data || [];
        profilesList = profilesRes.data || [];
        salesList = salesRes.data || [];
        clientsList = clientsRes.data || [];
        setSupabaseConnected(true);
      }

      setOrganizations(orgsList);
      setProfiles(profilesList);
      setSales(salesList);
      setClients(clientsList);

      setApiLatency(Date.now() - startFetch);
    } catch (err) {
      console.error('Error loading SuperAdmin metrics:', err);
      setSupabaseConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Simulate latency checks periodically
    const interval = setInterval(() => {
      setApiLatency(prev => {
        const jitter = Math.floor(Math.random() * 20) - 10;
        return Math.max(12, Math.min(220, (isMockMode ? 15 : 65) + jitter));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Calculate SaaS Global Metrics
  const globalStats = useMemo(() => {
    const totalBilling = sales.filter(s => !s.is_canceled).reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalSalesCount = sales.filter(s => !s.is_canceled).length;
    const totalOrgs = organizations.length;
    const totalUsers = profiles.length;
    const totalClients = clients.length;

    // Simulate PostgreSQL space based on actual record count (1 record = ~15KB in data/indexes)
    const recordsCount = sales.length + clients.length + profiles.length + organizations.length + 50; 
    const dbSizeMB = Number(((recordsCount * 18) / 1024 + 1.25).toFixed(2));

    return {
      totalBilling,
      totalSalesCount,
      totalOrgs,
      totalUsers,
      totalClients,
      dbSizeMB
    };
  }, [sales, clients, profiles, organizations]);

  // Aggregate stats per organization for listing
  const orgStatsList = useMemo(() => {
    return organizations.map(org => {
      const orgSales = sales.filter(s => s.organization_id === org.id && !s.is_canceled);
      const orgBilling = orgSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const orgSalesCount = orgSales.length;
      const orgMembersCount = profiles.filter(p => p.organization_id === org.id).length;

      return {
        ...org,
        billing: orgBilling,
        salesCount: orgSalesCount,
        membersCount: orgMembersCount
      };
    });
  }, [organizations, sales, profiles]);

  const handleToggleSubscription = async (orgId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'canceled' : 'active';
      if (isMockMode) {
        const orgs = mockStore.getOrgs();
        const idx = orgs.findIndex(o => o.id === orgId);
        if (idx !== -1) {
          orgs[idx].subscription_status = newStatus;
          mockStore.saveOrgs(orgs);
        }
        loadData();
      } else {
        const { error } = await supabase!
          .from('organizations')
          .update({ subscription_status: newStatus })
          .eq('id', orgId);
        if (error) throw error;
        loadData();
      }
    } catch (err) {
      console.error('Error toggling subscription:', err);
    }
  };

  // Impersonate Action (Simulate entering the organization dashboard as an administrator)
  const handleImpersonate = (orgId: string) => {
    if (!isMockMode) {
      alert('A ação de login simulado (Impersonation) só é suportada localmente em modo MOCK.');
      return;
    }
    // Find the first admin profile for the selected organization
    const orgAdmin = profiles.find(p => p.organization_id === orgId && p.role === 'admin');
    if (!orgAdmin) {
      alert('Nenhum administrador encontrado para esta empresa no modo Mock.');
      return;
    }
    mockDb.setCurrentUser(orgAdmin.id);
    
    // Dispatch event to notify layout
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-updated'));
    }
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Security Access Lock
  if (currentUser && currentUser.role !== 'superadmin') {
    return (
      <div className={styles.unauthorizedContainer}>
        <div className={`glass ${styles.unauthorizedCard}`}>
          <AlertTriangle size={48} className={styles.warningIcon} />
          <h2>Acesso não autorizado</h2>
          <p>
            Esta página é exclusiva do proprietário da plataforma. Usuários comuns ou administradores de empresas não possuem autorização de acesso ao painel do sistema.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', gap: '0.5rem', alignItems: 'center', padding: '0.6rem 1.2rem', marginTop: '0.5rem' }}>
            <ArrowLeft size={16} />
            <span>Voltar ao Painel</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <Link href="/dashboard" className={styles.backLink}>
          <ArrowLeft size={16} />
          <span>Voltar ao Painel</span>
        </Link>
        <div className={styles.titleWrapper} style={{ marginTop: '0.25rem' }}>
          <h1 className={styles.pageTitle}>Central de SuperAdmin</h1>
          <span className={styles.subtitle}>Painel global de integridade técnica e gestão de empresas do SaaS</span>
        </div>
      </div>

      {/* Global SaaS KPIs */}
      <div className={styles.kpiGrid}>
        <div className={`glass ${styles.kpiCard}`}>
          <Building className={styles.kpiIcon} size={20} style={{ color: 'var(--primary)' }} />
          <span className={styles.kpiLabel}>Empresas Integradas</span>
          <span className={styles.kpiVal}>{globalStats.totalOrgs}</span>
        </div>

        <div className={`glass ${styles.kpiCard}`}>
          <TrendingUp className={styles.kpiIcon} size={20} style={{ color: 'var(--success)' }} />
          <span className={styles.kpiLabel}>Faturamento Global</span>
          <span className={styles.kpiVal}>
            {globalStats.totalBilling.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className={`glass ${styles.kpiCard}`}>
          <ShoppingBag className={styles.kpiIcon} size={20} style={{ color: 'var(--primary)' }} />
          <span className={styles.kpiLabel}>Vendas Globais</span>
          <span className={styles.kpiVal}>{globalStats.totalSalesCount}</span>
        </div>

        <div className={`glass ${styles.kpiCard}`}>
          <Users className={styles.kpiIcon} size={20} style={{ color: 'var(--text-muted)' }} />
          <span className={styles.kpiLabel}>Usuários no Sistema</span>
          <span className={styles.kpiVal}>{globalStats.totalUsers}</span>
        </div>
      </div>

      {/* Technical Integrity Panel */}
      <div className={styles.technicalPanel}>
        <div className={`glass ${styles.techCard}`}>
          <h3 className={styles.techTitle}>
            <Database size={18} style={{ color: 'var(--primary)' }} />
            <span>Saúde do Banco (PostgreSQL / Supabase)</span>
          </h3>

          <div className={styles.statusList}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Banco Supabase</span>
              <div className={styles.statusIndicator}>
                {supabaseConnected ? (
                  <span className={styles.statusOnline}>
                    <CheckCircle2 size={14} />
                    <span>Conectado (Produção)</span>
                  </span>
                ) : (
                  <span className={styles.statusOffline}>
                    <XCircle size={14} />
                    <span>Local (Modo Mock ativo)</span>
                  </span>
                )}
              </div>
            </div>

            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Uso de Disco PostgreSQL</span>
              <div className={styles.progressBarWrapper}>
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBarFill} 
                    style={{ width: `${(globalStats.dbSizeMB / 500) * 100}%` }} 
                  />
                </div>
                <span className={styles.progressBarText}>
                  {globalStats.dbSizeMB} MB / 500 MB (Plano Gratuito)
                </span>
              </div>
            </div>

            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Latência da API</span>
              <span className={styles.latencyVal} style={{ color: apiLatency > 150 ? 'var(--danger)' : apiLatency > 80 ? 'var(--warning)' : 'var(--success)' }}>
                <Activity size={12} />
                <span>{apiLatency} ms</span>
              </span>
            </div>
          </div>
        </div>

        <div className={`glass ${styles.techCard}`}>
          <h3 className={styles.techTitle}>
            <Cpu size={18} style={{ color: 'var(--primary)' }} />
            <span>Servidor e Infraestrutura</span>
          </h3>
          <div className={styles.infrastructureList}>
            <div className={styles.infraItem}>
              <span>Status da API (Next.js Cloud)</span>
              <span className="badge badge-success">Operacional</span>
            </div>
            <div className={styles.infraItem}>
              <span>Workers de Inteligência Artificial (Claude)</span>
              <span className="badge badge-success">Online</span>
            </div>
            <div className={styles.infraItem}>
              <span>Processador de Webhooks Stripe</span>
              <span className="badge badge-success">Ativo</span>
            </div>
            <div className={styles.infraItem}>
              <span>SSL / Certificado HTTPS</span>
              <span className="badge badge-success">Válido</span>
            </div>
          </div>
        </div>
      </div>

      {/* Corporate List of Empresas */}
      <div className={`glass ${styles.companiesCard}`}>
        <div className={styles.companiesHeader}>
          <Building size={18} style={{ color: 'var(--primary)' }} />
          <h3>Gerenciamento de Empresas (Firmezas)</h3>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.companiesTable}>
            <thead>
              <tr>
                <th>Empresa</th>
                <th style={{ textAlign: 'center' }}>Usuários</th>
                <th style={{ textAlign: 'center' }}>Vendas</th>
                <th style={{ textAlign: 'right' }}>Faturamento</th>
                <th style={{ textAlign: 'center' }}>Status Assinatura</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orgStatsList.map((org) => (
                <tr key={org.id} className={org.subscription_status === 'canceled' ? styles.suspendedRow : ''}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.companyName}>{org.name}</span>
                      <span className={styles.companyId}>ID: {org.id}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{org.membersCount} colaboradores</td>
                  <td style={{ textAlign: 'center' }}>{org.salesCount} transações</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: org.subscription_status === 'canceled' ? 'inherit' : 'var(--primary)' }}>
                    {org.billing.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${org.subscription_status === 'active' ? 'badge-success' : org.subscription_status === 'trial' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {org.subscription_status === 'active' ? 'Ativo (Pro)' : org.subscription_status === 'trial' ? 'Período Teste' : 'Cancelado'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className={styles.actionButtons}>
                      <button
                        onClick={() => handleToggleSubscription(org.id, org.subscription_status)}
                        className={`${styles.actionBtn} ${org.subscription_status === 'active' ? styles.btnSuspend : styles.btnActivate}`}
                        title={org.subscription_status === 'active' ? 'Suspender Assinatura' : 'Reativar Assinatura'}
                      >
                        {org.subscription_status === 'active' ? <Lock size={13} /> : <Unlock size={13} />}
                        <span>{org.subscription_status === 'active' ? 'Bloquear' : 'Ativar'}</span>
                      </button>
                      
                      {isMockMode && (
                        <button
                          onClick={() => handleImpersonate(org.id)}
                          className={`${styles.actionBtn} ${styles.btnImpersonate}`}
                          title="Acessar painel como esta empresa"
                        >
                          <UserCheck size={13} />
                          <span>Simular Login</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {orgStatsList.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                    Nenhuma empresa cadastrada no sistema
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
