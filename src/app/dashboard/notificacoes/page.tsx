'use client';

import { useState, useMemo } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { isMockMode, mockDb } from '@/lib/supabase';
import { Notification } from '@/lib/types';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Info, 
  AlertTriangle, 
  TrendingUp, 
  Coins, 
  Package, 
  User, 
  CreditCard, 
  Shield, 
  Sparkles,
  Pin,
  Play,
  ArrowUpRight
} from 'lucide-react';
import styles from './page.module.css';

// Helper de tempo relativo em português
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    
    return date.toLocaleDateString('pt-BR');
  } catch (err) {
    return '';
  }
}

// Icones por tipo
function getNotificationIcon(type: string, priority: string) {
  const size = 20;
  if (priority === 'critical') return <AlertTriangle size={size} />;
  
  switch (type) {
    case 'sales':
      return <TrendingUp size={size} />;
    case 'fiado':
      return <Coins size={size} />;
    case 'stock':
      return <Package size={size} />;
    case 'billing':
      return <CreditCard size={size} />;
    case 'team':
      return <User size={size} />;
    case 'security':
      return <Shield size={size} />;
    case 'ai_insight':
      return <Sparkles size={size} />;
    default:
      return <Info size={size} />;
  }
}

// Estilo de prioridade
function getPriorityClass(priority: string) {
  switch (priority) {
    case 'critical': return styles.priorityCritical;
    case 'high': return styles.priorityHigh;
    case 'low': return styles.priorityLow;
    case 'positive': return styles.priorityPositive;
    default: return styles.priorityMedium;
  }
}

// Tradução de tipo/source para badge
function getTypeLabel(type: string) {
  switch (type) {
    case 'system': return 'Sistema';
    case 'sales': return 'Vendas';
    case 'fiado': return 'Fiado';
    case 'stock': return 'Estoque';
    case 'billing': return 'Faturamento';
    case 'team': return 'Equipe';
    case 'security': return 'Segurança';
    case 'ai_insight': return 'Insight IA';
    default: return 'Geral';
  }
}

export default function NotificacoesPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading, error, refetch } = useNotifications();
  const { user } = useAuth();
  
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimulatorOptions, setShowSimulatorOptions] = useState(false);

  // Calcular estatísticas da Central de Notificações
  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = unreadCount;
    const pinned = notifications.filter(n => n.is_pinned).length;
    const highOrCritical = notifications.filter(n => n.priority === 'high' || n.priority === 'critical').length;
    
    return { total, unread, pinned, highOrCritical };
  }, [notifications, unreadCount]);

  // Filtragem de notificações
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'unread') return notif.status === 'unread';
      return notif.type === activeFilter;
    });
  }, [notifications, activeFilter]);

  // Agrupamento temporal
  const temporalGroups = useMemo(() => {
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const thisWeek: Notification[] = [];
    const older: Notification[] = [];
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfThisWeek = startOfToday - 6 * 86400000; // últimos 7 dias

    filteredNotifications.forEach(notif => {
      const time = new Date(notif.created_at).getTime();
      if (time >= startOfToday) {
        today.push(notif);
      } else if (time >= startOfYesterday) {
        yesterday.push(notif);
      } else if (time >= startOfThisWeek) {
        thisWeek.push(notif);
      } else {
        older.push(notif);
      }
    });

    return { today, yesterday, thisWeek, older };
  }, [filteredNotifications]);

  // Injetar notificações de teste
  const handleSimulateTestNotification = async (scenario: number) => {
    setIsSimulating(true);
    setShowSimulatorOptions(false);

    let testData: any = {};

    switch (scenario) {
      case 1:
        testData = {
          title: '⚠️ Limite de fiado quase esgotado',
          message: 'O cliente Restaurante Bom Sabor atingiu 92% do limite de crédito.',
          description: 'Débito atual de R$ 2.760,00 de um limite de R$ 3.000,00. Evite novas vendas a prazo sem amortização.',
          type: 'fiado',
          priority: 'high',
          source: 'system',
          is_pinned: false,
          action_url: '/dashboard/fiado',
          action_label: 'Analisar Fiados'
        };
        break;
      case 2:
        testData = {
          title: '📦 Estoque crítico: Banana Prata',
          message: 'O estoque de Banana Prata esgotou totalmente.',
          description: 'A variante Prata Tipo 1 atingiu zero caixas. Recomendamos reabastecer com urgência.',
          type: 'stock',
          priority: 'high',
          source: 'system',
          is_pinned: false,
          action_url: '/dashboard/produtos',
          action_label: 'Ver Estoque'
        };
        break;
      case 3:
        testData = {
          title: '🚨 Cobrança recusada',
          message: 'O pagamento da sua assinatura BoxHub Pro falhou.',
          description: 'Houve uma recusa do cartão de crédito cadastrado na fatura de vencimento atual. Por favor, regularize as informações de pagamento para evitar bloqueio.',
          type: 'billing',
          priority: 'critical',
          source: 'billing',
          is_pinned: true,
          action_url: '/dashboard/planos',
          action_label: 'Atualizar Faturamento'
        };
        break;
      case 4:
        testData = {
          title: '🛡️ Novo membro de equipe adicionado',
          message: 'Um novo vendedor foi cadastrado na sua equipe do Box.',
          description: 'O perfil de Carlos Vendedor (usr-seller-789) foi vinculado à sua organização com sucesso.',
          type: 'team',
          priority: 'low',
          source: 'manual',
          is_pinned: false,
          action_url: '/dashboard/vendedores',
          action_label: 'Ver Equipe'
        };
        break;
      default:
        testData = {
          title: '📢 Manutenção programada do sistema',
          message: 'O sistema passará por manutenção rápida neste domingo às 02h.',
          description: 'Duração estimada: 15 minutos. Nenhuma ação é necessária da sua parte.',
          type: 'system',
          priority: 'low',
          source: 'system',
          is_pinned: false
        };
    }

    try {
      if (isMockMode) {
        // Modo Mock local
        mockDb.notifications.insert(testData.title, testData.message, testData);
        refetch();
      } else {
        // Real Mode API call
        const res = await fetch('/api/notifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });

        if (!res.ok) {
          throw new Error('Falha ao injetar notificação de teste no banco real.');
        }
        refetch();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao simular notificação.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleItemClick = (notificationId: string, actionUrl: string | null, status: string) => {
    if (status === 'unread') {
      markAsRead(notificationId);
    }
    if (actionUrl) {
      window.location.href = actionUrl;
    }
  };

  const hasNotifications = filteredNotifications.length > 0;

  return (
    <div className={styles.pageContainer}>
      {/* 1. HEADER */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>Central de Notificações</h1>
          <p className={styles.pageSubtitle}>Acompanhe alertas, prazos de fiado, alterações de estoque e novidades do sistema.</p>
        </div>
        
        <div className={styles.headerActions}>
          {/* Botão simulador de notificações para testes rápidos */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowSimulatorOptions(!showSimulatorOptions)}
              disabled={isSimulating}
              className={styles.btnSimulation}
              title="Testar injeção de notificações internas"
            >
              <Play size={14} />
              {isSimulating ? 'Injetando...' : 'Testar Notificação'}
            </button>
            
            {showSimulatorOptions && (
              <div className="glass" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '220px', display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.25rem', zIndex: 100 }}>
                <button onClick={() => handleSimulateTestNotification(1)} style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
                  💰 Alerta de Fiado (Alta)
                </button>
                <button onClick={() => handleSimulateTestNotification(2)} style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
                  📦 Alerta de Estoque (Alta)
                </button>
                <button onClick={() => handleSimulateTestNotification(3)} style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
                  🚨 Faturamento (Crítica/Pin)
                </button>
                <button onClick={() => handleSimulateTestNotification(4)} style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
                  🛡️ Cadastro Equipe (Baixa)
                </button>
                <button onClick={() => handleSimulateTestNotification(5)} style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '0.4rem', fontSize: '0.75rem', cursor: 'pointer', borderRadius: '4px' }}>
                  📢 Manutenção Sistema (Informativa)
                </button>
              </div>
            )}
          </div>

          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead} 
              className="btn-secondary" 
              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', borderRadius: '20px' }}
            >
              <CheckCheck size={14} />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {/* 2. STATS KPI GRID */}
      <div className={styles.statsGrid}>
        <div className={styles.statsCard}>
          <div className={`${styles.statsIconWrapper} ${styles.statsIconPrimary}`}>
            <Bell size={20} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsNumber}>{stats.total}</span>
            <span className={styles.statsLabel}>Total Recebidas</span>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={`${styles.statsIconWrapper} ${styles.statsIconWarning}`}>
            <Check size={20} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsNumber}>{stats.unread}</span>
            <span className={styles.statsLabel}>Não Lidas</span>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={`${styles.statsIconWrapper} ${styles.statsIconDanger}`}>
            <Pin size={20} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsNumber}>{stats.pinned}</span>
            <span className={styles.statsLabel}>Fixadas</span>
          </div>
        </div>

        <div className={styles.statsCard}>
          <div className={`${styles.statsIconWrapper} ${styles.statsIconSuccess}`}>
            <AlertTriangle size={20} />
          </div>
          <div className={styles.statsContent}>
            <span className={styles.statsNumber}>{stats.highOrCritical}</span>
            <span className={styles.statsLabel}>Críticas / Importantes</span>
          </div>
        </div>
      </div>

      {/* 3. FILTER TABS ROW */}
      <div className={styles.filtersRow}>
        <div className={styles.tabsList}>
          <button 
            onClick={() => setActiveFilter('all')} 
            className={`${styles.tabBtn} ${activeFilter === 'all' ? styles.tabBtnActive : ''}`}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveFilter('unread')} 
            className={`${styles.tabBtn} ${activeFilter === 'unread' ? styles.tabBtnActive : ''}`}
          >
            Não Lidas ({unreadCount})
          </button>
          <button 
            onClick={() => setActiveFilter('system')} 
            className={`${styles.tabBtn} ${activeFilter === 'system' ? styles.tabBtnActive : ''}`}
          >
            Sistema
          </button>
          <button 
            onClick={() => setActiveFilter('sales')} 
            className={`${styles.tabBtn} ${activeFilter === 'sales' ? styles.tabBtnActive : ''}`}
          >
            Vendas
          </button>
          <button 
            onClick={() => setActiveFilter('fiado')} 
            className={`${styles.tabBtn} ${activeFilter === 'fiado' ? styles.tabBtnActive : ''}`}
          >
            Fiado
          </button>
          <button 
            onClick={() => setActiveFilter('stock')} 
            className={`${styles.tabBtn} ${activeFilter === 'stock' ? styles.tabBtnActive : ''}`}
          >
            Estoque
          </button>
          <button 
            onClick={() => setActiveFilter('billing')} 
            className={`${styles.tabBtn} ${activeFilter === 'billing' ? styles.tabBtnActive : ''}`}
          >
            Faturamento
          </button>
        </div>
      </div>

      {/* 4. MAIN LIST */}
      <div className={styles.notificationsContainer}>
        {loading && notifications.length === 0 ? (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.skeletonCard}>
                <div className={styles.skeletonIcon} />
                <div className={styles.skeletonContent}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonText} />
                  <div className={styles.skeletonTextShort} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className={styles.emptyState} style={{ borderColor: 'var(--danger)' }}>
            <AlertTriangle size={36} className={styles.emptyIcon} style={{ color: 'var(--danger)' }} />
            <h3 className={styles.emptyTitle}>Erro ao carregar notificações</h3>
            <p className={styles.emptyText}>{error}</p>
          </div>
        ) : !hasNotifications ? (
          <div className={styles.emptyState}>
            <CheckCheck size={36} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>Nenhuma notificação encontrada</h3>
            <p className={styles.emptyText}>Você não tem notificações que correspondam ao filtro selecionado.</p>
          </div>
        ) : (
          <>
            {/* GRUPO 1: HOJE */}
            {temporalGroups.today.length > 0 && (
              <div className={styles.temporalGroup}>
                <div className={styles.temporalHeader}>
                  <h3 className={styles.temporalTitle}>Hoje</h3>
                  <div className={styles.temporalLine} />
                </div>
                
                <div className={styles.notificationsList}>
                  {temporalGroups.today.map(renderNotificationCard)}
                </div>
              </div>
            )}

            {/* GRUPO 2: ONTEM */}
            {temporalGroups.yesterday.length > 0 && (
              <div className={styles.temporalGroup}>
                <div className={styles.temporalHeader}>
                  <h3 className={styles.temporalTitle}>Ontem</h3>
                  <div className={styles.temporalLine} />
                </div>
                
                <div className={styles.notificationsList}>
                  {temporalGroups.yesterday.map(renderNotificationCard)}
                </div>
              </div>
            )}

            {/* GRUPO 3: ESTA SEMANA */}
            {temporalGroups.thisWeek.length > 0 && (
              <div className={styles.temporalGroup}>
                <div className={styles.temporalHeader}>
                  <h3 className={styles.temporalTitle}>Esta Semana</h3>
                  <div className={styles.temporalLine} />
                </div>
                
                <div className={styles.notificationsList}>
                  {temporalGroups.thisWeek.map(renderNotificationCard)}
                </div>
              </div>
            )}

            {/* GRUPO 4: ANTERIORES */}
            {temporalGroups.older.length > 0 && (
              <div className={styles.temporalGroup}>
                <div className={styles.temporalHeader}>
                  <h3 className={styles.temporalTitle}>Mais Antigas</h3>
                  <div className={styles.temporalLine} />
                </div>
                
                <div className={styles.notificationsList}>
                  {temporalGroups.older.map(renderNotificationCard)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Renderizador de card individual
  function renderNotificationCard(notif: Notification) {
    const isUnread = notif.status === 'unread';
    const isPinned = notif.is_pinned;
    const priorityClass = getPriorityClass(notif.priority);

    return (
      <div 
        key={notif.id}
        onClick={() => handleItemClick(notif.id, notif.action_url, notif.status)}
        className={`${styles.notificationCard} ${isUnread ? styles.unreadCard : ''} ${isPinned ? styles.pinnedCard : ''}`}
      >
        <div className={styles.cardBody}>
          <div className={`${styles.iconWrapper} ${priorityClass}`}>
            {getNotificationIcon(notif.type, notif.priority)}
          </div>

          <div className={styles.cardContent}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>{notif.title}</h4>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {isPinned && (
                  <span className={styles.pinnedIndicator}>
                    <Pin size={10} fill="currentColor" />
                    Fixada
                  </span>
                )}
                {isUnread && (
                  <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '0.15rem 0.35rem' }}>
                    Nova
                  </span>
                )}
              </div>
            </div>

            <p className={styles.cardMessage}>{notif.message}</p>
            {notif.description && (
              <p className={styles.cardDesc}>{notif.description}</p>
            )}

            <div className={styles.cardFooter}>
              <div className={styles.metaInfo}>
                <span className={styles.cardTime}>{formatRelativeTime(notif.created_at)}</span>
                <span className={styles.typeBadge}>{getTypeLabel(notif.type)}</span>
              </div>

              <div className={styles.cardActions}>
                {notif.action_url && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemClick(notif.id, notif.action_url, notif.status);
                    }}
                    className={styles.actionBtn}
                  >
                    {notif.action_label || 'Acessar'}
                    <ArrowUpRight size={14} />
                  </button>
                )}

                {isUnread && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(notif.id);
                    }}
                    className={styles.markReadBtn}
                    title="Marcar como lida"
                  >
                    <Check size={12} />
                    Marcar como lida
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
