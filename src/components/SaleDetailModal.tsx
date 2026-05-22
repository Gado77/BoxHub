'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import styles from './SaleDetailModal.module.css';

interface SaleDetailModalProps {
  sale: any;
  onClose: () => void;
  onSaleUpdated?: () => void;
}

export default function SaleDetailModal({ sale, onClose, onSaleUpdated }: SaleDetailModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('Venda Direta');
  const [isConfirming, setIsConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      try {
        // Resolve client name
        if (sale.client_id) {
          if (isMockMode) {
            const client = mockDb.clients.list().find((c: any) => c.id === sale.client_id);
            setClientName(client ? client.name : 'Venda Direta');
          } else {
            if (sale.clients?.name) {
              setClientName(sale.clients.name);
            } else {
              const { data: client } = await supabase!
                .from('clients')
                .select('name')
                .eq('id', sale.client_id)
                .single();
              setClientName(client ? client.name : 'Venda Direta');
            }
          }
        } else {
          setClientName('Venda Direta');
        }

        // Fetch items
        if (isMockMode) {
          const saleItems = mockDb.sales.items(sale.id);
          const productsList = mockDb.products.list();
          const allVariants = mockStore.getVariants();
          const mappedItems = saleItems.map(item => {
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
          const { data, error } = await supabase!
            .from('sale_items')
            .select('*, products(name), variants(name)')
            .eq('sale_id', sale.id);
          
          if (error) throw error;
          
          const mappedItems = (data || []).map(item => ({
            ...item,
            product_name: item.products?.name || 'Produto Desconhecido',
            variant_name: item.variants?.name || ''
          }));
          setItems(mappedItems);
        }
      } catch (err) {
        console.error('Error loading sale details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (sale) {
      loadDetails();
    }
  }, [sale]);

  const handleCancelSale = async () => {
    setCanceling(true);
    try {
      if (isMockMode) {
        mockDb.sales.cancel(sale.id);
      } else {
        const { error } = await supabase!
          .from('sales')
          .update({ is_canceled: true } as any)
          .eq('id', sale.id);
        if (error) throw error;
      }
      if (onSaleUpdated) {
        onSaleUpdated();
      }
      onClose();
    } catch (err) {
      console.error('Error canceling sale:', err);
      alert('Não foi possível cancelar a venda.');
    } finally {
      setCanceling(false);
      setIsConfirming(false);
    }
  };

  if (!sale) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} glass`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalTitle}>
              Detalhes da Venda {sale.is_canceled && <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>(Cancelada)</span>}
            </h3>
            <span className={styles.modalSubtitle}>
              {new Date(sale.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Cliente</span>
            <span className={styles.detailValue} style={sale.is_canceled ? { textDecoration: 'line-through', opacity: 0.7 } : {}}>{clientName}</span>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Forma de Pagamento</span>
            <div>
              {sale.payment_method === 'fiado' && (
                <span className="badge badge-danger" style={sale.is_canceled ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>Fiado</span>
              )}
              {sale.payment_method === 'pix' && (
                <span className="badge badge-success" style={sale.is_canceled ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>PIX</span>
              )}
              {sale.payment_method === 'dinheiro' && (
                <span className="badge badge-warning" style={sale.is_canceled ? { textDecoration: 'line-through', opacity: 0.6 } : {}}>Dinheiro</span>
              )}
            </div>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Status</span>
            {sale.is_canceled ? (
              <span className="badge" style={{ backgroundColor: 'rgba(120, 120, 120, 0.2)', color: 'var(--text-muted)' }}>
                Cancelada
              </span>
            ) : (
              <span className={`badge ${sale.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>
                {sale.status === 'pago' ? 'Pago' : 'Pendente'}
              </span>
            )}
          </div>

          <div className={styles.itemsSection}>
            <h4 className={styles.itemsTitle}>Itens da Venda</h4>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
                <div className="loading-spinner"></div>
              </div>
            ) : items.length === 0 ? (
              <p className={styles.noItemsText}>Nenhum item encontrado para esta venda.</p>
            ) : (
              <div className={styles.itemsList}>
                {items.map((item, idx) => (
                  <div key={item.id || idx} className={styles.itemRow} style={sale.is_canceled ? { opacity: 0.7 } : {}}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName} style={sale.is_canceled ? { textDecoration: 'line-through' } : {}}>
                        {item.product_name}
                      </span>
                      {item.variant_name && (
                        <span className={styles.itemVariant}>
                          • {item.variant_name}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemMath}>
                      <span className={styles.itemQty}>
                        {item.quantity} cx
                      </span>
                      <span className={styles.itemTimes}>×</span>
                      <span className={styles.itemPrice}>
                        {Number(item.price_per_box || item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <span className={styles.itemTotal} style={sale.is_canceled ? { textDecoration: 'line-through' } : {}}>
                      {Number(item.total_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.totalSection}>
            <span className={styles.totalLabel}>Valor Total</span>
            <span className={styles.totalAmount} style={sale.is_canceled ? { textDecoration: 'line-through', opacity: 0.6, color: 'var(--text-muted)' } : {}}>
              {Number(sale.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className={styles.modalFooter}>
          {isConfirming ? (
            <div className={styles.confirmCancelWrapper}>
              <span className={styles.confirmCancelText}>Tem certeza que deseja cancelar esta venda? Esta ação reverterá o estoque e saldo devedor do fiado.</span>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.75rem' }}>
                <button 
                  className="btn-danger" 
                  style={{ flex: 1, justifyContent: 'center' }} 
                  onClick={handleCancelSale}
                  disabled={canceling}
                >
                  {canceling ? 'Cancelando...' : 'Sim, Cancelar'}
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, justifyContent: 'center' }} 
                  onClick={() => setIsConfirming(false)}
                  disabled={canceling}
                >
                  Não
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                Fechar
              </button>
              {!sale.is_canceled && (
                <button 
                  className={styles.cancelSaleBtn} 
                  onClick={() => setIsConfirming(true)}
                >
                  Cancelar Venda
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
