'use client';

import { useState, useEffect } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { X, Plus, Trash2, CheckCircle2, UserPlus, ShoppingBag, Coins, CreditCard, AlertTriangle, Search } from 'lucide-react';
import styles from './NewSaleModal.module.css';

interface NewSaleModalProps {
  onClose: () => void;
  onSaleCreated: () => void;
}

interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  quantity: number;
  pricePerBox: number;
  totalPrice: number;
}

export default function NewSaleModal({ onClose, onSaleCreated }: NewSaleModalProps) {
  // Lists loaded from Database
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  
  // Selection States
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'fiado'>('pix');

  // Autocomplete Search States
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Quick Client Creation State
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientType, setNewClientType] = useState<'quitanda' | 'restaurante' | 'mercado' | 'outro'>('outro');
  const [newClientContact, setNewClientContact] = useState('');
  const [newClientLimit, setNewClientLimit] = useState('1500');

  // Item Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');

  // Cart & Submission state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client Fiado Status
  const [clientFiadoBalance, setClientFiadoBalance] = useState(0);

  // Sync search input when client selection changes (e.g. via direct click or Quick Client onboarding)
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setClientSearchTerm(client.name);
      }
    } else {
      setClientSearchTerm('');
    }
  }, [selectedClientId, clients]);

  // Load clients and products on mount
  useEffect(() => {
    const loadData = async () => {
      if (isMockMode) {
        setClients(mockDb.clients.list());
        setProducts(mockDb.products.list());
      } else {
        const { data: clientData } = await supabase!.from('clients').select('*').order('name');
        const { data: productData } = await supabase!.from('products').select('*').order('name');
        setClients(clientData || []);
        setProducts(productData || []);
      }
    };
    loadData();
  }, []);

  // Load variants when product selection changes
  useEffect(() => {
    const loadVariants = async () => {
      setSelectedVariantId('');
      if (!selectedProductId) {
        setVariants([]);
        return;
      }
      
      if (isMockMode) {
        setVariants(mockDb.products.variants(selectedProductId));
      } else {
        const { data } = await supabase!
          .from('product_variants')
          .select('*')
          .eq('product_id', selectedProductId)
          .order('name');
        setVariants(data || []);
      }
    };
    loadVariants();
  }, [selectedProductId]);

  // Load selected client's fiado balance if client and payment method is fiado
  useEffect(() => {
    if (!selectedClientId) {
      setClientFiadoBalance(0);
      return;
    }
    
    const fetchBalance = async () => {
      if (isMockMode) {
        setClientFiadoBalance(mockDb.fiado.getBalance(selectedClientId));
      } else {
        // Query database to sum outstanding fiado sales and subtract amortized payments
        const { data: sales } = await supabase!
          .from('sales')
          .select('total_amount')
          .eq('client_id', selectedClientId)
          .eq('payment_method', 'fiado')
          .eq('status', 'pendente');

        const { data: payments } = await supabase!
          .from('fiado_payments')
          .select('amount')
          .eq('client_id', selectedClientId);

        const totalDebt = (sales || []).reduce((acc, curr) => acc + Number(curr.total_amount), 0);
        const totalPaid = (payments || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

        setClientFiadoBalance(Math.max(0, totalDebt - totalPaid));
      }
    };
    fetchBalance();
  }, [selectedClientId, paymentMethod]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    try {
      if (isMockMode) {
        const newClient = mockDb.clients.insert(
          newClientName,
          newClientType,
          newClientContact,
          Number(newClientLimit)
        );
        setClients(mockDb.clients.list());
        setSelectedClientId(newClient.id);
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;
        
        const { data, error: err } = await supabase!
          .from('clients')
          .insert({
            organization_id: orgId,
            name: newClientName,
            type: newClientType,
            contact: newClientContact,
            fiado_limit: Number(newClientLimit)
          })
          .select()
          .single();

        if (err) throw err;
        setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedClientId(data.id);
      }

      // Reset Form fields
      setNewClientName('');
      setNewClientContact('');
      setNewClientLimit('1500');
      setShowQuickClient(false);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar cliente.');
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !price || !quantity) return;

    const product = products.find(p => p.id === selectedProductId);
    const variant = variants.find(v => v.id === selectedVariantId);
    
    const quantityNum = parseInt(quantity);
    const priceNum = parseFloat(price);

    const newItem: CartItem = {
      id: `${selectedProductId}-${selectedVariantId || 'no-var'}-${Date.now()}`,
      productId: selectedProductId,
      productName: product?.name || '',
      variantId: selectedVariantId || null,
      variantName: variant?.name || null,
      quantity: quantityNum,
      pricePerBox: priceNum,
      totalPrice: quantityNum * priceNum
    };

    setCart(prev => [...prev, newItem]);
    
    // Clear item inputs for next item
    setSelectedProductId('');
    setPrice('');
    setQuantity('1');
  };

  const handleRemoveItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + item.totalPrice, 0);
  };

  const handleSubmitSale = async () => {
    if (cart.length === 0) {
      setError('Adicione pelo menos um item ao carrinho.');
      return;
    }
    if (paymentMethod === 'fiado' && !selectedClientId) {
      setError('Vendas fiadas exigem a seleção de um cliente cadastrado.');
      return;
    }

    setLoading(true);
    setError(null);

    const totalAmount = calculateTotal();
    const selectedClient = clients.find(c => c.id === selectedClientId);

    // Verify limit on Fiado
    if (paymentMethod === 'fiado' && selectedClient) {
      const remainingLimit = selectedClient.fiado_limit - clientFiadoBalance;
      if (totalAmount > remainingLimit) {
        setError(`Atenção: Limite do fiado excedido! O limite disponível de ${selectedClient.name} é R$ ${remainingLimit.toFixed(2)} (Limite total: R$ ${selectedClient.fiado_limit.toFixed(2)}, Em aberto: R$ ${clientFiadoBalance.toFixed(2)}).`);
        setLoading(false);
        return;
      }
    }

    try {
      if (isMockMode) {
        mockDb.sales.insert(
          selectedClientId || null,
          paymentMethod,
          cart.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            pricePerBox: item.pricePerBox
          }))
        );
        await new Promise(r => setTimeout(r, 600));
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;
        const sellerId = (await supabase!.auth.getUser()).data.user?.id;

        // Insert sale
        const { data: saleData, error: saleErr } = await supabase!
          .from('sales')
          .insert({
            organization_id: orgId,
            client_id: selectedClientId || null,
            seller_id: sellerId,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            status: paymentMethod === 'fiado' ? 'pendente' : 'pago'
          })
          .select()
          .single();

        if (saleErr) throw saleErr;

        // Insert items
        const itemsToInsert = cart.map(item => ({
          sale_id: saleData.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          price_per_box: item.pricePerBox,
          total_price: item.totalPrice
        }));

        const { error: itemsErr } = await supabase!
          .from('sale_items')
          .insert(itemsToInsert);

        if (itemsErr) throw itemsErr;

        // Deduct inventory if organization settings has stock control enabled
        const { data: orgData } = await supabase!
          .from('organizations')
          .select('settings')
          .eq('id', orgId)
          .single();

        if (orgData?.settings?.estoque_ativo) {
          for (const item of cart) {
            if (item.variantId) {
              await supabase!.rpc('deduct_variant_stock', {
                var_id: item.variantId,
                qty: item.quantity
              });
            } else {
              await supabase!.rpc('deduct_product_stock', {
                prod_id: item.productId,
                qty: item.quantity
              });
            }
          }
        }
      }

      onSaleCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao registrar a venda.');
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} glass`}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>
            <ShoppingBag size={20} className={styles.logoIcon} />
            <span>Registrar Nova Venda</span>
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {error && (
            <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={16} style={{ minWidth: '16px' }} />
              <span style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          {/* Client Selection */}
          <div className={styles.clientSection}>
            <label className="form-label">Cliente</label>
            <div className={styles.clientSelectorRow}>
              <div className={styles.searchContainer}>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Buscar cliente pelo nome..."
                  value={clientSearchTerm}
                  onChange={(e) => {
                    setClientSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                    if (e.target.value === '') {
                      setSelectedClientId('');
                    }
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      setIsDropdownOpen(false);
                      const originalClient = clients.find(c => c.id === selectedClientId);
                      setClientSearchTerm(originalClient ? originalClient.name : '');
                    }, 200);
                  }}
                  style={{ paddingRight: '40px' }}
                />
                
                {clientSearchTerm ? (
                  <button 
                    type="button"
                    className={styles.clearSearchBtn}
                    onClick={() => {
                      setSelectedClientId('');
                      setClientSearchTerm('');
                    }}
                    title="Limpar seleção"
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <Search size={16} className={styles.searchIconRight} />
                )}

                {isDropdownOpen && (
                  <div className={styles.autocompleteDropdown}>
                    <div 
                      className={`${styles.autocompleteOption} ${styles.optionDirectSale} ${!selectedClientId ? styles.optionActive : ''}`}
                      onMouseDown={() => {
                        setSelectedClientId('');
                        setClientSearchTerm('');
                        setIsDropdownOpen(false);
                      }}
                    >
                      -- Venda Direta (Sem Cliente Identificado) --
                    </div>
                    {(() => {
                      const filtered = clients.filter(c => 
                        c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <div className={styles.optionEmpty}>Nenhum cliente encontrado</div>;
                      }
                      return filtered.map(c => (
                        <div 
                          key={c.id}
                          className={`${styles.autocompleteOption} ${selectedClientId === c.id ? styles.optionActive : ''}`}
                          onMouseDown={() => {
                            setSelectedClientId(c.id);
                            setClientSearchTerm(c.name);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <span>{c.name}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{c.type.toUpperCase()}</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <button 
                type="button" 
                className={styles.quickAddBtn}
                title="Cadastrar Cliente Rápido"
                onClick={() => setShowQuickClient(!showQuickClient)}
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>

          {/* Quick Client Onboarding Mini Form */}
          {showQuickClient && (
            <form onSubmit={handleAddClient} className={styles.miniForm}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nome do Cliente</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: Quitanda do Zé"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de Firma</label>
                <select 
                  className="form-control"
                  value={newClientType}
                  onChange={(e: any) => setNewClientType(e.target.value)}
                >
                  <option value="quitanda">Quitanda</option>
                  <option value="restaurante">Restaurante</option>
                  <option value="mercado">Mercado</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Limite de Fiado (R$)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="1500"
                  value={newClientLimit}
                  onChange={(e) => setNewClientLimit(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label">Contato/WhatsApp</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="(11) 99999-9999"
                  value={newClientContact}
                  onChange={(e) => setNewClientContact(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={() => setShowQuickClient(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                  Salvar Cliente
                </button>
              </div>
            </form>
          )}

          {/* Add Item Form */}
          <form onSubmit={handleAddItem} className={styles.itemFormCard}>
            <div className={styles.cartHeader}>Adicionar Produtos ao Carrinho</div>
            <div className={styles.formGrid}>
              <div className="form-group">
                <label className="form-label">Produto</label>
                <select 
                  className="form-control" 
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Variante (Opcional)</label>
                <select 
                  className="form-control"
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  disabled={variants.length === 0}
                >
                  <option value="">{variants.length === 0 ? 'Sem variantes' : 'Padrão / Selecione...'}</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Caixas</label>
                <input 
                  type="number" 
                  className="form-control"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preço/Caixa</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="form-control" 
                  placeholder="0.00"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className={`btn-primary ${styles.addItemBtn}`} style={{ marginTop: '0.25rem', width: 'fit-content', alignSelf: 'flex-end' }}>
              <Plus size={16} />
              <span>Adicionar Produto</span>
            </button>
          </form>

          {/* Cart Table List */}
          {cart.length > 0 && (
            <div className={styles.cartSection}>
              <div className={styles.cartHeader}>Itens da Venda</div>
              <div className={styles.cartTableWrapper}>
                <table className={styles.cartTable}>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Variante</th>
                      <th style={{ textAlign: 'center' }}>Caixas</th>
                      <th style={{ textAlign: 'right' }}>Preço Unit.</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.id}>
                        <td>{item.productName}</td>
                        <td>{item.variantName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhuma</span>}</td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>R$ {item.pricePerBox.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>R$ {item.totalPrice.toFixed(2)}</td>
                        <td>
                          <button className={styles.removeBtn} onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className={styles.paymentSection}>
            <label className="form-label">Forma de Pagamento</label>
            <div className={styles.paymentGrid}>
              <div 
                className={`${styles.paymentOption} ${paymentMethod === 'pix' ? styles.paymentActive : ''}`}
                onClick={() => setPaymentMethod('pix')}
              >
                <CreditCard size={20} />
                <span>PIX</span>
              </div>
              <div 
                className={`${styles.paymentOption} ${paymentMethod === 'dinheiro' ? styles.paymentActive : ''}`}
                onClick={() => setPaymentMethod('dinheiro')}
              >
                <Coins size={20} />
                <span>Dinheiro</span>
              </div>
              <div 
                className={`${styles.paymentOption} ${paymentMethod === 'fiado' ? styles.paymentActive : ''}`}
                onClick={() => setPaymentMethod('fiado')}
              >
                <AlertTriangle size={20} />
                <span>Fiado</span>
              </div>
            </div>

            {/* Fiado warning & limit logic details */}
            {paymentMethod === 'fiado' && (
              <div className={`${styles.fiadoAlert} ${(selectedClient && (calculateTotal() > (selectedClient.fiado_limit - clientFiadoBalance))) ? styles.fiadoDanger : ''}`}>
                {!selectedClientId ? (
                  <span>⚠️ <strong>Atenção:</strong> Você precisa selecionar um cliente acima para poder autorizar uma venda no fiado.</span>
                ) : selectedClient ? (
                  <div>
                    <strong>Fiado para {selectedClient.name}:</strong><br />
                    • Limite Total da Ficha: R$ {selectedClient.fiado_limit.toFixed(2)}<br />
                    • Débito em Aberto Atual: R$ {clientFiadoBalance.toFixed(2)}<br />
                    • Limite Disponível Restante: R$ {(selectedClient.fiado_limit - clientFiadoBalance).toFixed(2)}<br />
                    {calculateTotal() > 0 && (
                      <span style={{ display: 'block', marginTop: '0.4rem', fontWeight: 600 }}>
                        {calculateTotal() > (selectedClient.fiado_limit - clientFiadoBalance) 
                          ? `❌ Venda atual (R$ ${calculateTotal().toFixed(2)}) excede o saldo limite disponível!`
                          : `✓ Saldo suficiente para a venda de R$ ${calculateTotal().toFixed(2)}.`
                        }
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Footer Summary & Submit actions */}
        <div className={styles.footer}>
          <div className={styles.totalContainer}>
            <span className={styles.totalLabel}>Total da Venda</span>
            <span className={styles.totalVal}>R$ {calculateTotal().toFixed(2)}</span>
          </div>

          <div className={styles.submitActions}>
            <button className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSubmitSale} 
              disabled={loading || cart.length === 0 || (paymentMethod === 'fiado' && !selectedClientId)}
            >
              {loading ? <span className="loading-spinner"></span> : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirmar Venda</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
