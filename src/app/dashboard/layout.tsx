'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase, isMockMode, mockDb, CRM_BRANDING } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Users, 
  Apple, 
  Settings, 
  LogOut, 
  Sprout, 
  Sun, 
  Moon, 
  Plus,
  ChevronLeft, 
  ChevronRight,
  ShoppingBag,
  Menu,
  X,
  TrendingUp,
  Coins,
  UserCheck,
  ShieldAlert
} from 'lucide-react';
import styles from './dashboard.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  
  // Theme and Sidebar States
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        if (isMockMode) {
          const currentUser = mockDb.getCurrentUser();
          const currentOrg = mockDb.getOrg();
          
          if (!currentUser) {
            router.push('/login');
            return;
          }
          setUser(currentUser);
          setOrg(currentOrg);
        } else {
          const { data: { session } } = await supabase!.auth.getSession();
          if (!session) {
            router.push('/login');
            return;
          }

          // Fetch profile and organization from Supabase
          const { data: profile } = await supabase!
            .from('profiles')
            .select('*, organizations(*)')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setUser(profile);
            setOrg(profile.organizations);
          } else {
            // Profile not found in database (e.g. user was deleted in backend)
            await supabase!.auth.signOut();
            setUser(null);
            setOrg(null);
            router.push('/login');
            return;
          }
        }
      } catch (err) {
        console.error('Error loading session data:', err);
      } finally {
        setLoading(false);
      }
    };

    // Load user preferences
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('boxhub-theme') as 'light' | 'dark';
      if (storedTheme) {
        setTheme(storedTheme);
        document.documentElement.setAttribute('data-theme', storedTheme);
      } else {
        const sysTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        setTheme(sysTheme);
        document.documentElement.setAttribute('data-theme', sysTheme);
      }

      const storedCollapsed = localStorage.getItem('boxhub-sidebar-collapsed') === 'true';
      setIsCollapsed(storedCollapsed);
    }

    checkAuthAndLoadData();

    const handleProfileUpdate = () => {
      checkAuthAndLoadData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('profile-updated', handleProfileUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('profile-updated', handleProfileUpdate);
      }
    };
  }, [router]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('boxhub-theme', nextTheme);
  };

  const toggleSidebar = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem('boxhub-sidebar-collapsed', String(nextCollapsed));
  };

  const handleLogout = async () => {
    if (isMockMode) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('boxhub_current_user_id');
      }
      router.push('/login');
    } else {
      await supabase!.auth.signOut();
      router.push('/login');
    }
  };

   const openNewSale = () => {
     if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('open-new-sale-modal'));
     }
   };


  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
      </div>
    );
  }

  // Helper to check active state
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  const getPageTitle = () => {
    if (pathname.includes('/clientes')) return 'Clientes';
    if (pathname.includes('/fiado')) return 'Gestão de Fiado';
    if (pathname.includes('/vendas')) return 'Histórico de Vendas';
    if (pathname.includes('/vendedores')) return 'Vendedores';
    if (pathname.includes('/superadmin')) return 'SuperAdmin';
    if (pathname.includes('/produtos')) return 'Produtos';
    if (pathname.includes('/relatorios')) return 'Relatórios';
    if (pathname.includes('/configuracoes')) return 'Configurações';
    return 'Painel de Vendas';
  };

  return (
    <div className={styles.layoutContainer}>
      {/* 1. DESKTOP SIDEBAR */}
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''} glass`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderTop}>
            {!isCollapsed ? (
              <div className={styles.brandingWrapper}>
                {org?.settings?.logo_url ? (
                  <div className={styles.logoContainer}>
                    <img src={org.settings.logo_url} alt={org?.name || 'Box'} className={styles.companyLogoImg} />
                  </div>
                ) : (
                  <div className={styles.logoContainer}>
                    <img
                      src={theme === 'dark' ? CRM_BRANDING.logoDark : CRM_BRANDING.logoLight}
                      alt="BoxHub"
                      className={styles.crmFullLogo}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.logoContainerCollapsed}>
                <div className={styles.collapsedLogoStack}>
                  <img src={CRM_BRANDING.logoIcon} alt="" className={styles.companyIconImg} />
                  <span className={styles.crmMiniBadge}>BH</span>
                </div>
              </div>
            )}
            
            <button 
              onClick={toggleSidebar} 
              className={styles.collapseBtn} 
              title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
 
          <nav className={styles.navigation}>
            <Link 
              href="/dashboard" 
              className={`${styles.navLink} ${isActive('/dashboard') ? styles.navLinkActive : ''}`}
              title="Painel"
            >
              <LayoutDashboard size={20} />
              {!isCollapsed && <span>Painel</span>}
            </Link>
            <Link 
              href="/dashboard/vendas" 
              className={`${styles.navLink} ${isActive('/dashboard/vendas') ? styles.navLinkActive : ''}`}
              title="Vendas"
            >
              <ShoppingBag size={20} />
              {!isCollapsed && <span>Vendas</span>}
            </Link>
            <Link 
              href="/dashboard/clientes" 
              className={`${styles.navLink} ${isActive('/dashboard/clientes') ? styles.navLinkActive : ''}`}
              title="Clientes"
            >
              <Users size={20} />
              {!isCollapsed && <span>Clientes</span>}
            </Link>
            <Link 
              href="/dashboard/fiado" 
              className={`${styles.navLink} ${isActive('/dashboard/fiado') ? styles.navLinkActive : ''}`}
              title="Fiado"
            >
              <Coins size={20} />
              {!isCollapsed && <span>Fiado</span>}
            </Link>
            <Link 
              href="/dashboard/produtos" 
              className={`${styles.navLink} ${isActive('/dashboard/produtos') ? styles.navLinkActive : ''}`}
              title="Produtos"
            >
              <Apple size={20} />
              {!isCollapsed && <span>Produtos</span>}
            </Link>
            <Link 
              href="/dashboard/relatorios" 
              className={`${styles.navLink} ${isActive('/dashboard/relatorios') ? styles.navLinkActive : ''}`}
              title="Relatórios"
            >
              <TrendingUp size={20} />
              {!isCollapsed && <span>Relatórios</span>}
            </Link>
            {user?.role === 'admin' && (
              <Link 
                href="/dashboard/vendedores" 
                className={`${styles.navLink} ${isActive('/dashboard/vendedores') ? styles.navLinkActive : ''}`}
                title="Vendedores"
              >
                <UserCheck size={20} />
                {!isCollapsed && <span>Vendedores</span>}
              </Link>
            )}
            {user?.role === 'superadmin' && (
              <Link 
                href="/dashboard/superadmin" 
                className={`${styles.navLink} ${isActive('/dashboard/superadmin') ? styles.navLinkActive : ''}`}
                title="SuperAdmin"
              >
                <ShieldAlert size={20} />
                {!isCollapsed && <span>SuperAdmin</span>}
              </Link>
            )}
            <Link 
              href="/dashboard/configuracoes" 
              className={`${styles.navLink} ${isActive('/dashboard/configuracoes') ? styles.navLinkActive : ''}`}
              title="Configurações"
            >
              <Settings size={20} />
              {!isCollapsed && <span>Configurações</span>}
            </Link>
          </nav>
        </div>

        {/* User Card */}
        {user && (
          <div className={`${styles.userCard} ${isCollapsed ? styles.userCardCollapsed : ''}`}>
            {!isCollapsed ? (
              <>
                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.name} className={styles.avatarImg} />
                    ) : (
                      user.name ? user.name.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className={styles.userDetails}>
                    <span className={styles.userName}>{user.name}</span>
                    <span className={styles.userOrgName}>{org?.name || 'Box CEAGESP'}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <span className={styles.userRoleBadge}>{user.role}</span>
                  <button onClick={handleLogout} className={styles.logoutBtn}>
                    <LogOut size={14} />
                    <span>Sair</span>
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.userCardCollapsedContent}>
                <div className={styles.avatar} title={`${user.name} (${org?.name || 'Box CEAGESP'})`}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className={styles.avatarImg} />
                  ) : (
                    user.name ? user.name.charAt(0).toUpperCase() : 'U'
                  )}
                </div>
                <button onClick={handleLogout} className={styles.logoutBtnCollapsed} title="Sair do BoxHub">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className={styles.mainArea}>
        {/* Top Header (Desktop Only) */}
        <header className={styles.topBar}>
          <h2 className={styles.pageTitle}>{getPageTitle()}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user?.role === 'admin' && (
              <Link href="/dashboard/configuracoes#subscription-plan" className={styles.badgeLink}>
                <span className="badge badge-success" style={{ fontWeight: '500', cursor: 'pointer' }}>
                  {org?.subscription_status === 'trial' ? 'Período de Teste' : 'Assinante Pro'}
                </span>
              </Link>
            )}
            
            {/* New Sale Button Desktop */}
            {pathname === '/dashboard' && (
              <button 
                onClick={openNewSale}
                className={styles.newSaleBtn}
                title="Registrar nova venda"
              >
                <Plus size={14} />
                <span>Nova Venda</span>
              </button>
            )}

            {/* Theme Toggle Button Desktop */}
            <button 
              onClick={toggleTheme} 
              className={styles.themeToggleBtn} 
              title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </button>
          </div>
        </header>

        {/* Mobile Header (Mobile Only) */}
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBranding}>
            {org?.settings?.logo_url ? (
              <img src={org.settings.logo_url} alt={org?.name || 'Box'} className={styles.mobileLogoImg} />
            ) : (
              <img
                src={theme === 'dark' ? CRM_BRANDING.logoDark : CRM_BRANDING.logoLight}
                alt="BoxHub"
                className={styles.mobileCrmLogo}
              />
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* New Sale Button Mobile */}
            {pathname === '/dashboard' && (
              <button 
                onClick={openNewSale}
                className={styles.newSaleBtnMobile}
                title="Registrar nova venda"
              >
                <Plus size={14} />
                <span className={styles.newSaleBtnTextMobile}>Nova Venda</span>
              </button>
            )}

            {/* Theme Toggle Button Mobile */}
            <button 
              onClick={toggleTheme} 
              className={styles.themeToggleBtnMobile} 
              title="Alternar tema"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            
            {user && (
              <div style={{ position: 'relative' }}>
                <div className={styles.mobileProfileAvatar}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    user.name ? user.name.charAt(0).toUpperCase() : 'U'
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Nested Content */}
        <main className={styles.contentWrapper}>
          {children}
        </main>

        {/* Mobile Bottom Navigation (Mobile Only) */}
        <nav className={styles.mobileNav}>
          <Link 
            href="/dashboard" 
            className={`${styles.mobileNavLink} ${isActive('/dashboard') ? styles.mobileNavLinkActive : ''}`}
          >
            <LayoutDashboard size={20} />
            <span>Painel</span>
          </Link>
          <Link 
            href="/dashboard/clientes" 
            className={`${styles.mobileNavLink} ${isActive('/dashboard/clientes') ? styles.mobileNavLinkActive : ''}`}
          >
            <Users size={20} />
            <span>Clientes</span>
          </Link>
          <Link 
            href="/dashboard/fiado" 
            className={`${styles.mobileNavLink} ${isActive('/dashboard/fiado') ? styles.mobileNavLinkActive : ''}`}
          >
            <Coins size={20} />
            <span>Fiado</span>
          </Link>
          <Link 
            href="/dashboard/produtos" 
            className={`${styles.mobileNavLink} ${isActive('/dashboard/produtos') ? styles.mobileNavLinkActive : ''}`}
          >
            <Apple size={20} />
            <span>Produtos</span>
          </Link>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`${styles.mobileNavBtn} ${isMobileMenuOpen ? styles.mobileNavLinkActive : ''}`}
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>

        {/* Mobile Menu Overlay / Bottom Sheet */}
        {isMobileMenuOpen && (
          <div className={styles.menuOverlay} onClick={() => setIsMobileMenuOpen(false)}>
            <div className={`${styles.menuSheet} glass`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.menuSheetHeader}>
                <h3 className={styles.menuSheetTitle}>Menu de Navegação</h3>
                <button className={styles.menuSheetCloseBtn} onClick={() => setIsMobileMenuOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className={styles.menuSheetGrid}>
                <Link 
                  href="/dashboard" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                    <LayoutDashboard size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Painel</span>
                </Link>
                <Link 
                  href="/dashboard/vendas" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/vendas') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <ShoppingBag size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Vendas</span>
                </Link>
                <Link 
                  href="/dashboard/clientes" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/clientes') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                    <Users size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Clientes</span>
                </Link>
                <Link 
                  href="/dashboard/fiado" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/fiado') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                    <Coins size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Fiado</span>
                </Link>
                <Link 
                  href="/dashboard/produtos" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/produtos') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    <Apple size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Produtos</span>
                </Link>
                <Link 
                  href="/dashboard/relatorios" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/relatorios') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <TrendingUp size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Relatórios</span>
                </Link>
                {user?.role === 'admin' && (
                  <Link 
                    href="/dashboard/vendedores" 
                    className={`${styles.menuSheetGridItem} ${isActive('/dashboard/vendedores') ? styles.menuGridActive : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                      <UserCheck size={24} />
                    </div>
                    <span className={styles.menuGridItemLabel}>Vendedores</span>
                  </Link>
                )}
                {user?.role === 'superadmin' && (
                  <Link 
                    href="/dashboard/superadmin" 
                    className={`${styles.menuSheetGridItem} ${isActive('/dashboard/superadmin') ? styles.menuGridActive : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                      <ShieldAlert size={24} />
                    </div>
                    <span className={styles.menuGridItemLabel}>SuperAdmin</span>
                  </Link>
                )}
                <Link 
                  href="/dashboard/configuracoes" 
                  className={`${styles.menuSheetGridItem} ${isActive('/dashboard/configuracoes') ? styles.menuGridActive : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className={styles.menuIconWrapper} style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <Settings size={24} />
                  </div>
                  <span className={styles.menuGridItemLabel}>Ajustes</span>
                </Link>
              </div>

              {user && (
                <div className={styles.menuProfileCard}>
                  <div className={styles.menuProfileHeader}>
                    <div className={styles.menuProfileAvatar}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        user.name ? user.name.charAt(0).toUpperCase() : 'U'
                      )}
                    </div>
                    <div className={styles.menuProfileInfo}>
                      <span className={styles.menuProfileName}>{user.name}</span>
                      <span className={styles.menuProfileOrg}>{org?.name || 'Box CEAGESP'}</span>
                    </div>
                    <span className={styles.menuProfileRole}>{user.role === 'admin' ? 'Admin' : 'Vendedor'}</span>
                  </div>
                  <button onClick={handleLogout} className={styles.menuLogoutBtn}>
                    <LogOut size={16} />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
