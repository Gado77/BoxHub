'use client';

import { useState, useEffect } from 'react';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { 
  Apple, 
  ChevronLeft,
  Search, 
  Plus, 
  Info,
  Boxes,
  PlusCircle,
  CheckCircle,
  Edit3,
  Trash2,
  Archive,
  X,
  Save,
  Package,
  AlertTriangle
} from 'lucide-react';
import styles from './produtos.module.css';

export default function ProdutosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [estoqueAtivo, setEstoqueAtivo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'frutas' | 'legumes'>('todos');
  const [viewingDetailMobile, setViewingDetailMobile] = useState(false);

  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'product' | 'variant'>('product');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newStock, setNewStock] = useState('100');
  const [newType, setNewType] = useState<'fruta' | 'legume'>('fruta');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editType, setEditType] = useState<'fruta' | 'legume'>('fruta');
  const [editStock, setEditStock] = useState('0');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [variantName, setVariantName] = useState('');
  const [variantStock, setVariantStock] = useState('50');
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantSuccess, setVariantSuccess] = useState(false);

  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantStock, setEditVariantStock] = useState('0');

  const loadData = async () => {
    try {
      if (isMockMode) {
        const org = mockDb.getOrg();
        setEstoqueAtivo(org.settings.estoque_ativo);
        const data = mockDb.products.list();
        setProducts(data);
        if (data.length > 0 && !selectedProductId) {
          setSelectedProductId(data[0].id);
        }
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;
        const { data: orgData } = await supabase!
          .from('organizations')
          .select('settings')
          .eq('id', orgId)
          .single();
        setEstoqueAtivo(orgData?.settings?.estoque_ativo || false);
        const { data } = await supabase!.from('products').select('*').order('name');
        setProducts(data || []);
        if ((data || []).length > 0 && !selectedProductId) {
          setSelectedProductId(data![0].id);
        }
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedProductId) { setVariants([]); return; }
    if (isMockMode) {
      setVariants(mockDb.products.variants(selectedProductId));
    } else {
      (async () => {
        const { data } = await supabase!
          .from('product_variants')
          .select('*')
          .eq('product_id', selectedProductId)
          .order('name');
        setVariants(data || []);
      })();
    }
  }, [selectedProductId, products]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'todos' || p.type === (activeTab === 'frutas' ? 'fruta' : 'legume');
    return matchesSearch && matchesTab;
  });

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const getTotalStock = (product: any) => {
    if (!estoqueAtivo) return null;
    if (isMockMode) {
      return mockDb.products.getTotalStock(product.id);
    }
    if (selectedProductId === product.id && variants.length > 0) {
      return variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
    }
    return product.stock_quantity || 0;
  };

  const getStockStatus = (product: any) => {
    if (!estoqueAtivo) return null;
    const total = getTotalStock(product);
    if (product.status === 'archived') return { label: 'Arquivado', class: 'badge badge-warning' };
    if (product.status === 'inactive') return { label: 'Inativo', class: 'badge' };
    if (total === 0 || total === null) return { label: 'Sem Estoque', class: 'badge badge-danger' };
    if (total < 10) return { label: 'Estoque Baixo', class: 'badge badge-warning' };
    return { label: 'Em Estoque', class: 'badge badge-success' };
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      if (isMockMode) {
        const newProd = mockDb.products.insert(newName, newDesc, estoqueAtivo ? Number(newStock) : 0, newCategory, newType);
        setProducts(mockDb.products.list());
        setSelectedProductId(newProd.id);
      } else {
        const orgId = (await supabase!.from('profiles').select('organization_id').eq('id', (await supabase!.auth.getUser()).data.user?.id).single()).data?.organization_id;
        const { data, error } = await supabase!
          .from('products')
          .insert({
            organization_id: orgId,
            name: newName,
            description: newDesc,
            stock_quantity: estoqueAtivo ? Number(newStock) : 0,
            category: newCategory,
            type: newType,
            status: 'active'
          })
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedProductId(data.id);
      }
      setNewName(''); setNewDesc(''); setNewCategory(''); setNewStock('100'); setNewType('fruta');
      setShowNewModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar produto.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = () => {
    if (!selectedProduct) return;
    setEditName(selectedProduct.name);
    setEditDesc(selectedProduct.description || '');
    setEditCategory(selectedProduct.category || '');
    setEditType(selectedProduct.type || 'fruta');
    setEditStock(String(selectedProduct.stock_quantity || 0));
    setEditError(null);
    setShowEditModal(true);
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !editName.trim()) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const stockVal = estoqueAtivo && variants.length === 0 ? Number(editStock) : (selectedProduct?.stock_quantity || 0);
      if (isMockMode) {
        mockDb.products.update(selectedProductId, { 
          name: editName, 
          description: editDesc, 
          category: editCategory,
          type: editType,
          stock_quantity: stockVal
        });
        setProducts(mockDb.products.list());
      } else {
        const { data, error } = await supabase!
          .from('products')
          .update({
            name: editName,
            description: editDesc,
            category: editCategory,
            type: editType,
            stock_quantity: stockVal
          })
          .eq('id', selectedProductId)
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => prev.map(p => p.id === selectedProductId ? data : p));
      }
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Erro ao atualizar produto.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProductId || !showDeleteConfirm) return;
    try {
      if (isMockMode) {
        if (deleteType === 'product') {
          mockDb.products.remove(selectedProductId);
        } else {
          mockDb.products.removeVariant(showDeleteConfirm);
        }
        setProducts(mockDb.products.list());
        if (deleteType === 'product') {
          setSelectedProductId(null);
          setViewingDetailMobile(false);
        }
      } else {
        if (deleteType === 'product') {
          const { error } = await supabase!
            .from('products')
            .update({ status: 'archived', archived_at: new Date().toISOString() })
            .eq('id', selectedProductId);
          if (error) throw error;
          setSelectedProductId(null);
          setViewingDetailMobile(false);
        } else {
          const { error } = await supabase!
            .from('product_variants')
            .delete()
            .eq('id', showDeleteConfirm);
          if (error) throw error;
        }
        const { data } = await supabase!.from('products').select('*').order('name');
        setProducts(data || []);
      }
    } catch (err) {
      console.error('Error deleting/archiving:', err);
    }
    setShowDeleteConfirm(null);
  };

  const handleArchiveProduct = async () => {
    if (!selectedProductId || !selectedProduct) return;
    try {
      if (isMockMode) {
        const isArchived = selectedProduct.status === 'archived';
        mockDb.products.update(selectedProductId, { 
          status: isArchived ? 'active' : 'archived', 
          archived_at: isArchived ? null : new Date().toISOString() 
        });
        setProducts(mockDb.products.list());
      } else {
        const isArchived = selectedProduct.status === 'archived';
        const { data, error } = await supabase!
          .from('products')
          .update({
            status: isArchived ? 'active' : 'archived',
            archived_at: isArchived ? null : new Date().toISOString()
          })
          .eq('id', selectedProductId)
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setProducts(prev => prev.map(p => p.id === selectedProductId ? data : p));
        }
      }
    } catch (err) {
      console.error('Error archiving product:', err);
    }
  };

  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !variantName.trim()) return;
    setVariantLoading(true);
    try {
      if (isMockMode) {
        mockDb.products.insertVariant(selectedProductId, variantName, estoqueAtivo ? Number(variantStock) : 0);
        setProducts(mockDb.products.list());
      } else {
        const { error } = await supabase!
          .from('product_variants')
          .insert({
            product_id: selectedProductId,
            name: variantName.trim(),
            stock_quantity: estoqueAtivo ? Number(variantStock) : 0
          });
        if (error) throw error;
        setProducts([...products]);
      }
      setVariantName(''); setVariantStock('50');
      setVariantSuccess(true);
      setTimeout(() => setVariantSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error creating variant:', err);
    } finally {
      setVariantLoading(false);
    }
  };

  const startEditVariant = (variant: any) => {
    setEditingVariantId(variant.id);
    setEditVariantName(variant.name);
    setEditVariantStock(String(variant.stock_quantity || 0));
  };

  const handleUpdateVariant = async (e: React.FormEvent, variantId: string) => {
    e.preventDefault();
    if (!editVariantName.trim()) return;
    try {
      if (isMockMode) {
        mockDb.products.updateVariant(variantId, {
          name: editVariantName.trim(),
          stock_quantity: Number(editVariantStock)
        });
        setProducts(mockDb.products.list());
      } else {
        const { error } = await supabase!
          .from('product_variants')
          .update({
            name: editVariantName.trim(),
            stock_quantity: Number(editVariantStock)
          })
          .eq('id', variantId);
        if (error) throw error;
        const { data: updatedProducts } = await supabase!.from('products').select('*').order('name');
        setProducts(updatedProducts || []);
      }
      setEditingVariantId(null);
    } catch (err) {
      console.error('Error updating variant:', err);
    }
  };

  const confirmDelete = (type: 'product' | 'variant', id: string) => {
    setDeleteType(type);
    setShowDeleteConfirm(id);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`${styles.container} ${viewingDetailMobile ? styles.showDetail : styles.showList}`}>
      <div className={styles.topRow}>
        <div className={styles.leftCol}>
          <div className={`${styles.listCard} glass`}>
            <div className={styles.listHeader}>
              <span className={styles.listTitle}>
                {activeTab === 'todos' ? 'Produtos' : activeTab === 'frutas' ? 'Frutas' : 'Legumes'} ({filteredProducts.length})
              </span>
              <button
                className="btn-primary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.25rem' }}
                onClick={() => { setCreateError(null); setShowNewModal(true); }}
              >
                <Plus size={14} />
                <span>Novo</span>
              </button>
            </div>

            <div className={styles.tabContainer}>
              <button 
                type="button" 
                className={`${styles.tabButton} ${activeTab === 'todos' ? styles.tabButtonActive : ''}`}
                onClick={() => setActiveTab('todos')}
              >
                Todos
              </button>
              <button 
                type="button" 
                className={`${styles.tabButton} ${activeTab === 'frutas' ? styles.tabButtonActive : ''}`}
                onClick={() => setActiveTab('frutas')}
              >
                Frutas
              </button>
              <button 
                type="button" 
                className={`${styles.tabButton} ${activeTab === 'legumes' ? styles.tabButtonActive : ''}`}
                onClick={() => setActiveTab('legumes')}
              >
                Legumes
              </button>
            </div>

            <div className={styles.searchBar}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nome..."
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '36px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.productList}>
              {filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {searchTerm 
                    ? (activeTab === 'todos' ? 'Nenhum produto encontrado.' : activeTab === 'frutas' ? 'Nenhuma fruta encontrada.' : 'Nenhum legume encontrado.') 
                    : (activeTab === 'todos' ? 'Nenhum produto cadastrado.' : activeTab === 'frutas' ? 'Nenhuma fruta cadastrada.' : 'Nenhum legume cadastrado.')
                  }
                </div>
              ) : (
                filteredProducts.map(p => {
                  const stockStatus = getStockStatus(p);
                  const totalStock = getTotalStock(p);
                  return (
                    <div
                      key={p.id}
                      className={`${styles.productItem} ${selectedProductId === p.id ? styles.productItemActive : ''}`}
                      onClick={() => {
                        setSelectedProductId(p.id);
                        setViewingDetailMobile(true);
                      }}
                    >
                      <div className={styles.avatar}>
                        {getInitials(p.name)}
                      </div>
                      <div className={styles.productItemInfo}>
                        <div className={styles.nameRow}>
                          <span className={styles.productItemName}>{p.name}</span>
                          {totalStock !== null && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                              {totalStock} cx
                            </span>
                          )}
                        </div>
                        <div className={styles.productItemSub}>
                          {p.category || p.description || 'Sem categoria'}
                        </div>
                      </div>
                      {stockStatus && (
                        <span className={stockStatus.class}>{stockStatus.label}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {selectedProduct ? (
          <div className={styles.rightCol}>
            <div className={`${styles.detailCard} glass`}>
              <div className={styles.detailHeader}>
                <button 
                  onClick={() => setViewingDetailMobile(false)}
                  className={styles.backBtnMobile}
                  title="Voltar para a lista"
                >
                  <ChevronLeft size={16} />
                  <span>Voltar</span>
                </button>

                <div className={styles.productProfileArea}>
                  <div className={styles.avatarLarge}>
                    {getInitials(selectedProduct.name)}
                  </div>
                  <div className={styles.productMeta}>
                    <div className={styles.productTitleRow}>
                      <h2 className={styles.productTitle}>{selectedProduct.name}</h2>
                      {selectedProduct.category && (
                        <span className={styles.productTypeLabel}>{selectedProduct.category}</span>
                      )}
                    </div>
                    <div className={styles.contactInfo}>
                      <Info size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{selectedProduct.description || 'Nenhuma descrição'}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.headerActions}>
                  {estoqueAtivo && (
                    <div className={styles.stockTotalBox}>
                      <span className={styles.stockTotalValue}>{getTotalStock(selectedProduct)}</span>
                      <span className={styles.stockTotalLabel}>cx</span>
                    </div>
                  )}
                  <button onClick={openEditModal} className={styles.actionBtnSecondary}>
                    <Edit3 size={13} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => confirmDelete('product', selectedProduct.id)}
                    className={styles.actionBtnSecondary}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {estoqueAtivo && selectedProduct.status === 'active' && (
                <div className={styles.financialSection}>
                  <div className={styles.fiadoInfoGrid}>
                    <div className={`${styles.fiadoMetric} ${getTotalStock(selectedProduct) === 0 ? styles.fiadoAlertState : ''}`}>
                      <Package className={styles.fiadoMetricIcon} size={18} />
                      <span className={styles.fiadoMetricLabel}>Estoque Total</span>
                      <span className={styles.fiadoMetricVal}>
                        {getTotalStock(selectedProduct)} caixas
                      </span>
                    </div>
                    <div className={styles.fiadoMetric}>
                      <Boxes className={styles.fiadoMetricIcon} size={18} />
                      <span className={styles.fiadoMetricLabel}>Variantes</span>
                      <span className={styles.fiadoMetricVal}>{variants.length}</span>
                    </div>
                    <div className={styles.fiadoMetric}>
                      <AlertTriangle className={styles.fiadoMetricIcon} size={18} />
                      <span className={styles.fiadoMetricLabel}>Status</span>
                      <span className={styles.fiadoMetricVal} style={{ color: selectedProduct.status === 'active' ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'capitalize' }}>
                        {selectedProduct.status === 'active' ? 'Ativo' : selectedProduct.status === 'inactive' ? 'Inativo' : 'Arquivado'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!estoqueAtivo && (
                <div style={{ padding: '0 1.5rem 1.25rem' }}>
                  <div className={styles.infoNotice}>
                    <Info size={16} style={{ color: 'var(--primary)', minWidth: 16 }} />
                    <span>
                      <strong>Estoque desativado:</strong> O sistema está rodando sem controle físico de estoque. Você pode ativar o controle a qualquer momento nas configurações.
                    </span>
                  </div>
                </div>
              )}

              <div className={styles.historySection}>
                <h4 className={styles.historyTitle}>
                  <Boxes size={16} style={{ color: 'var(--primary)' }} />
                  <span>Variantes Cadastradas</span>
                </h4>

                {variantSuccess && (
                  <div className="badge badge-success" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <CheckCircle size={16} />
                    <span>Variante cadastrada com sucesso!</span>
                  </div>
                )}

                {variants.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    {selectedProduct.type === 'legume' ? 'Este legume' : 'Esta fruta'} não possui variantes. Adicione uma abaixo.
                  </div>
                ) : (
                  <div className={styles.variantGrid}>
                    {variants.map(v => {
                      const variantNameDisplay = v.name && v.name.trim() !== '' ? v.name.trim() : 'Variante sem nome';
                      const rawDate = v.updated_at || v.created_at;
                      let dateStr = '';
                      if (rawDate) {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) {
                          dateStr = d.toLocaleDateString('pt-BR');
                        }
                      }

                      if (editingVariantId === v.id) {
                        return (
                          <div key={v.id} className={styles.variantCard} style={{ padding: '0.6rem 0.8rem' }}>
                            <form onSubmit={(e) => handleUpdateVariant(e, v.id)} className={styles.editVariantInlineForm}>
                              <div className={styles.editVariantInlineInputs}>
                                <input
                                  type="text"
                                  className={styles.inputControlCompact}
                                  placeholder="Nome"
                                  required
                                  value={editVariantName}
                                  onChange={(e) => setEditVariantName(e.target.value)}
                                  style={{ flex: 1, minWidth: 0 }}
                                />
                                {estoqueAtivo && (
                                  <input
                                    type="number"
                                    className={styles.inputControlCompact}
                                    style={{ width: '80px' }}
                                    placeholder="Estoque"
                                    min="0"
                                    required
                                    value={editVariantStock}
                                    onChange={(e) => setEditVariantStock(e.target.value)}
                                  />
                                )}
                              </div>
                              <div className={styles.editVariantInlineActions}>
                                <button type="submit" className={styles.saveVariantBtn} title="Salvar">
                                  <Save size={14} />
                                </button>
                                <button type="button" onClick={() => setEditingVariantId(null)} className={styles.cancelVariantBtn} title="Cancelar">
                                  <X size={14} />
                                </button>
                              </div>
                            </form>
                          </div>
                        );
                      }

                      return (
                        <div key={v.id} className={styles.variantCard}>
                          <div className={styles.variantCardHeader}>
                            <span className={styles.variantCardName} title={variantNameDisplay}>
                              {variantNameDisplay}
                            </span>
                            <div className={styles.variantActions}>
                              <button
                                onClick={() => startEditVariant(v)}
                                className={styles.editVariantBtn}
                                title="Editar variante"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => confirmDelete('variant', v.id)}
                                className={styles.deleteVariantBtn}
                                title="Excluir variante"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {estoqueAtivo && (
                            <div className={styles.variantCardMeta} suppressHydrationWarning>
                              {v.stock_quantity || 0} {v.stock_quantity === 1 ? 'caixa' : 'caixas'}
                              {dateStr && ` · Atualizado ${dateStr}`}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className={styles.historySection} style={{ marginTop: '0.5rem' }}>
                  <button
                    className={styles.btnAddVariant}
                    onClick={() => setShowVariantForm(!showVariantForm)}
                  >
                    <PlusCircle size={14} />
                    <span>{showVariantForm ? 'Cancelar' : 'Adicionar Variante'}</span>
                  </button>

                  {showVariantForm && (
                    <form onSubmit={handleCreateVariant} className={styles.amortizeForm}>
                      <div className={styles.formInputGroup}>
                        <label className="form-label">Nome da Variante</label>
                        <input
                          type="text"
                          className={styles.inputControl}
                          placeholder="ex: Da Bahia, Do Sul"
                          required
                          value={variantName}
                          onChange={(e) => setVariantName(e.target.value)}
                        />
                      </div>
                      {estoqueAtivo && (
                        <div className={styles.formInputGroup} style={{ maxWidth: '120px' }}>
                          <label className="form-label">Estoque</label>
                          <input
                            type="number"
                            className={styles.inputControl}
                            min="0"
                            required
                            value={variantStock}
                            onChange={(e) => setVariantStock(e.target.value)}
                          />
                        </div>
                      )}
                      <button
                        type="submit"
                        className={styles.btnSubmit}
                        disabled={variantLoading}
                      >
                        {variantLoading ? <span className="loading-spinner"></span> : 'Adicionar'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleArchiveProduct}
                  className={styles.actionBtnSecondary}
                  style={{
                    fontSize: '0.75rem',
                    color: selectedProduct.status === 'archived' ? 'var(--success)' : 'inherit',
                    borderColor: selectedProduct.status === 'archived' ? 'rgba(29, 158, 117, 0.3)' : 'var(--border-color)'
                  }}
                >
                  <Archive size={13} />
                  <span>{selectedProduct.status === 'archived' 
                    ? (selectedProduct.type === 'legume' ? 'Desarquivar Legume' : 'Desarquivar Fruta') 
                    : (selectedProduct.type === 'legume' ? 'Arquivar Legume' : 'Arquivar Fruta')}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`${styles.emptyDetails} glass`}>
            <Apple size={48} style={{ color: 'var(--primary)', opacity: 0.4 }} />
            <div>
              <h3>Nenhum Produto Selecionado</h3>
              <p style={{ fontSize: '0.85rem', marginTop: '0.4rem', color: 'var(--text-muted)', maxWidth: '360px' }}>
                Selecione um produto no diretório lateral para visualizar variantes, estoque e informações detalhadas.
              </p>
            </div>
          </div>
        )}
      </div>

      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Apple size={18} style={{ color: 'var(--primary)' }} />
                <span>Novo Produto</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="badge badge-danger" style={{ width: '100%' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label">Tipo de Produto</label>
                <select 
                  className="form-control" 
                  value={newType} 
                  onChange={(e) => setNewType(e.target.value as 'fruta' | 'legume')}
                >
                  <option value="fruta">Fruta</option>
                  <option value="legume">Legume</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nome do Produto</label>
                <input type="text" className="form-control" placeholder="ex: Maracujá, Cenoura, Batata" required
                  value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria / Classificação</label>
                <input type="text" className="form-control" placeholder="ex: Cítrico, Raiz, Tubérculo"
                  value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (Opcional)</label>
                <input type="text" className="form-control" placeholder="ex: Caixa de maracujá doce selecionado"
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              {estoqueAtivo && (
                <div className="form-group">
                  <label className="form-label">Estoque Inicial (Caixas)</label>
                  <input type="number" className="form-control" min="0" required
                    value={newStock} onChange={(e) => setNewStock(e.target.value)} />
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" className="btn-secondary" style={{ height: '38px' }} onClick={() => setShowNewModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ height: '38px' }} disabled={createLoading}>
                  {createLoading ? <span className="loading-spinner"></span> : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedProduct && (
        <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Edit3 size={18} style={{ color: 'var(--primary)' }} />
                <span>Editar {selectedProduct.name}</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowEditModal(false)}>
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="badge badge-danger" style={{ width: '100%' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditProduct} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label">Tipo de Produto</label>
                <select 
                  className="form-control" 
                  value={editType} 
                  onChange={(e) => setEditType(e.target.value as 'fruta' | 'legume')}
                >
                  <option value="fruta">Fruta</option>
                  <option value="legume">Legume</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nome do Produto</label>
                <input type="text" className="form-control" required
                  value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria / Classificação</label>
                <input type="text" className="form-control"
                  value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <input type="text" className="form-control"
                  value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              {estoqueAtivo && variants.length === 0 && (
                <div className="form-group">
                  <label className="form-label">Estoque Atual (Caixas)</label>
                  <input type="number" className="form-control" min="0" required
                    value={editStock} onChange={(e) => setEditStock(e.target.value)} />
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" className="btn-secondary" style={{ height: '38px' }} onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" style={{ height: '38px' }} disabled={editLoading}>
                  {editLoading ? <span className="loading-spinner"></span> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Trash2 size={18} style={{ color: 'var(--danger)' }} />
                <span>Confirmar Exclusão</span>
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {deleteType === 'product'
                ? `Tem certeza que deseja arquivar "${selectedProduct?.name}"? O produto ficará oculto do catálogo mas os dados serão preservados.`
                : `Tem certeza que deseja excluir esta variante? Esta ação não pode ser desfeita.`
              }
            </p>
            <div className={styles.modalActions}>
              <button className="btn-secondary" style={{ height: '38px' }} onClick={() => setShowDeleteConfirm(null)}>
                Cancelar
              </button>
              <button className="btn-danger" style={{ height: '38px' }} onClick={handleDeleteProduct}>
                <Trash2 size={14} /> {deleteType === 'product' ? 'Arquivar' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
