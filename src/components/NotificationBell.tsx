'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
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
  ChevronRight
} from 'lucide-react';
import styles from './NotificationBell.module.css';

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    
    return date.toLocaleDateString('pt-BR');
  } catch (err) {
    return '';
  }
}

function getNotificationIcon(type: string, priority: string) {
  const size = 16;
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

function getPriorityClass(priority: string) {
  switch (priority) {
    case 'critical': return styles.priorityCritical;
    case 'high': return styles.priorityHigh;
    case 'low': return styles.priorityLow;
    case 'positive': return styles.priorityPositive;
    default: return styles.priorityMedium;
  }
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fechar o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleItemClick = (notificationId: string, actionUrl: string | null, status: string) => {
    // Marcar como lida se ainda estiver não lida
    if (status === 'unread') {
      markAsRead(notificationId);
    }
    setIsOpen(false);

    // Navegar se houver URL associada
    if (actionUrl) {
      router.push(actionUrl);
    }
  };

  const handleMarkOneAsRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // Evita navegar ao clicar apenas no botão de marcar como lida
    markAsRead(notificationId);
  };

  // Pegar apenas as últimas 5 notificações para o dropdown
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className={styles.bellContainer} ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className={`${styles.bellButton} ${isOpen ? styles.bellButtonActive : ''}`}
        title="Notificações"
        aria-expanded={isOpen}
      >
        <Bell size={18} className={styles.bellIcon} />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>Notificações</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className={styles.markAllReadBtn}
                title="Marcar todas como lidas"
              >
                Ler todas
              </button>
            )}
          </div>

          <div className={styles.notificationList}>
            {loading && notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className="loading-spinner" />
                <p className={styles.emptyText}>Carregando notificações...</p>
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <CheckCheck size={28} className={styles.emptyIcon} />
                <p className={styles.emptyText}>Tudo limpo por aqui!</p>
                <p className={styles.emptySubtext}>Nenhuma notificação nova no momento.</p>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const isUnread = notif.status === 'unread';
                const isPinned = notif.is_pinned;
                const priorityClass = getPriorityClass(notif.priority);

                return (
                  <div 
                    key={notif.id}
                    onClick={() => handleItemClick(notif.id, notif.action_url, notif.status)}
                    className={`${styles.notificationItem} ${isUnread ? styles.unreadItem : ''} ${isPinned ? styles.pinnedItem : ''}`}
                  >
                    <div className={`${styles.iconWrapper} ${priorityClass}`}>
                      {getNotificationIcon(notif.type, notif.priority)}
                    </div>
                    
                    <div className={styles.contentWrapper}>
                      <div className={styles.itemHeader}>
                        <h4 className={styles.itemTitle}>{notif.title}</h4>
                        {isPinned && (
                          <span className={styles.pinnedIndicator} title="Fixada">
                            <Pin size={10} fill="currentColor" />
                          </span>
                        )}
                      </div>
                      
                      <p className={styles.itemMessage}>{notif.message}</p>
                      
                      <div className={styles.itemFooter}>
                        <span className={styles.itemTime}>{formatRelativeTime(notif.created_at)}</span>
                        
                        <div className={styles.actionsContainer}>
                          {isUnread && (
                            <button
                              onClick={(e) => handleMarkOneAsRead(e, notif.id)}
                              className={styles.markReadBtn}
                              title="Marcar como lida"
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.dropdownFooter}>
            <Link 
              href="/dashboard/notificacoes" 
              onClick={() => setIsOpen(false)}
              className={styles.viewAllLink}
            >
              Ver todas as notificações
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
