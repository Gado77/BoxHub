'use client';

import { useState, useEffect } from 'react';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { 
  Settings, 
  Users, 
  CreditCard, 
  Check, 
  UserPlus, 
  ShieldCheck,
  AlertCircle,
  Pencil,
  Trash2,
  Building,
  MapPin,
  Phone,
  DollarSign,
  AlertTriangle,
  X,
  Plus,
  Crown,
  Camera
} from 'lucide-react';
import styles from './configuracoes.module.css';

export default function ConfiguracoesPage() {
  const [org, setOrg] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [estoqueAtivo, setEstoqueAtivo] = useState(false);
  const [loading, setLoading] = useState(true);

  // Box Details Form State
  const [boxName, setBoxName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultLimit, setDefaultLimit] = useState<number>(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Modal Visibility States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Selected Member for Edit/Delete
  const [selectedMember, setSelectedMember] = useState<any>(null);

  // Form states for Add/Edit Member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'vendedor'>('vendedor');
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<'admin' | 'vendedor'>('vendedor');

  // Modal actions status
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Load configuration details
  const loadConfigData = async () => {
    try {
      if (isMockMode) {
        const currentOrg = mockDb.getOrg();
        const user = mockDb.getCurrentUser();
        const profiles = mockDb.profiles.list();

        setOrg(currentOrg);
        setCurrentUser(user);
        setTeam(profiles);
        setEstoqueAtivo(currentOrg.settings?.estoque_ativo || false);

        setBoxName(currentOrg.name || '');
        setLocation(currentOrg.settings?.location || '');
        setPhone(currentOrg.settings?.phone || '');
        setDefaultLimit(currentOrg.settings?.default_limit || 0);
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase!
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setOrg(profile.organizations);
          setCurrentUser(profile);
          setEstoqueAtivo(profile.organizations.settings?.estoque_ativo || false);

          setBoxName(profile.organizations.name || '');
          setLocation(profile.organizations.settings?.location || '');
          setPhone(profile.organizations.settings?.phone || '');
          setDefaultLimit(profile.organizations.settings?.default_limit || 0);

          const { data: profiles } = await supabase!
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          setTeam(profiles || []);
        }
      }
    } catch (err) {
      console.error('Error loading config information:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigData();
  }, []);

  // Update Inventory Toggle setting immediately
  const handleToggleEstoque = async (checked: boolean) => {
    setEstoqueAtivo(checked);
    try {
      if (isMockMode) {
        mockDb.updateOrgSettings(checked);
      } else {
        const updatedSettings = { ...org.settings, estoque_ativo: checked };
        const { error } = await supabase!
          .from('organizations')
          .update({
            settings: updatedSettings
          })
          .eq('id', org.id);

        if (error) throw error;
        setOrg({ ...org, settings: updatedSettings });
      }
    } catch (err) {
      console.error('Error updating stock setting:', err);
      // rollback if failed
      setEstoqueAtivo(!checked);
    }
  };

  // Save general Box details
  const handleSaveBoxDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxName.trim()) {
      setSaveError('O nome do Box é obrigatório.');
      return;
    }

    setSaveLoading(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      if (isMockMode) {
        mockDb.updateOrg(boxName, {
          estoque_ativo: estoqueAtivo,
          location,
          phone,
          default_limit: defaultLimit
        });
        await new Promise(r => setTimeout(r, 600));
        await loadConfigData();
      } else {
        const updatedSettings = {
          ...org.settings,
          location,
          phone,
          default_limit: defaultLimit
        };

        const { error } = await supabase!
          .from('organizations')
          .update({
            name: boxName,
            settings: updatedSettings
          })
          .eq('id', org.id);

        if (error) throw error;
        await loadConfigData();
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving box details:', err);
      setSaveError(err.message || 'Erro ao salvar as configurações.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Team Actions: ADD member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setModalError('O nome é obrigatório.');
      return;
    }
    if (!isMockMode && !newMemberEmail.trim()) {
      setModalError('O e-mail é obrigatório para cadastrar no banco de dados real.');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      if (isMockMode) {
        const profiles = mockStore.getProfiles();
        profiles.push({
          id: `usr-${Date.now()}`,
          organization_id: org.id,
          name: newMemberName,
          role: newMemberRole
        });
        mockStore.saveProfiles(profiles);
        await new Promise(r => setTimeout(r, 500));
        await loadConfigData();
      } else {
        const res = await fetch('/api/team/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newMemberEmail,
            name: newMemberName,
            role: newMemberRole,
            organization_id: org.id
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erro ao adicionar membro.');
        }
        await loadConfigData();
      }

      // Reset and close
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('vendedor');
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Error adding member:', err);
      setModalError(err.message || 'Erro ao adicionar membro.');
    } finally {
      setModalLoading(false);
    }
  };

  // Team Actions: EDIT member details
  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMemberName.trim()) {
      setModalError('O nome é obrigatório.');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      if (isMockMode) {
        mockDb.profiles.update(selectedMember.id, editMemberName, editMemberRole);
        await new Promise(r => setTimeout(r, 500));
        await loadConfigData();
      } else {
        const { error } = await supabase!
          .from('profiles')
          .update({
            name: editMemberName,
            role: editMemberRole
          })
          .eq('id', selectedMember.id);

        if (error) throw error;
        await loadConfigData();
      }

      setIsEditModalOpen(false);
      setSelectedMember(null);
    } catch (err: any) {
      console.error('Error updating member:', err);
      setModalError(err.message || 'Erro ao atualizar membro.');
    } finally {
      setModalLoading(false);
    }
  };

  // Team Actions: DELETE member
  const handleDeleteMember = async () => {
    if (!selectedMember) return;
    setModalLoading(true);
    setModalError('');

    try {
      if (isMockMode) {
        mockDb.profiles.remove(selectedMember.id);
        await new Promise(r => setTimeout(r, 500));
        await loadConfigData();
      } else {
        const { error } = await supabase!
          .from('profiles')
          .delete()
          .eq('id', selectedMember.id);

        if (error) throw error;
        await loadConfigData();
      }

      setIsDeleteModalOpen(false);
      setSelectedMember(null);
    } catch (err: any) {
      console.error('Error removing member:', err);
      setModalError(err.message || 'Erro ao remover membro da equipe.');
    } finally {
      setModalLoading(false);
    }
  };

  // Reset Mock simulator database
  const handleResetSimulator = async () => {
    setModalLoading(true);
    try {
      mockStore.resetAll();
    } catch (err) {
      console.error(err);
      setModalLoading(false);
    }
  };

  // Simulates upgrading Stripe subscription locally (mock mode)
  const handleUpgradeMock = async (newStatus: 'active' | 'trial') => {
    if (!isMockMode) {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId: 'PRO_PRICE' })
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } catch (err) {
        console.error(err);
      }
      return;
    }

    setLoading(true);
    const orgs = mockStore.getOrgs();
    const current = orgs.find(o => o.id === org.id);
    if (current) {
      current.subscription_status = newStatus === 'active' ? 'active' : 'trial';
      mockStore.saveOrgs(orgs);
    }
    await new Promise(r => setTimeout(r, 600));
    loadConfigData();
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('A imagem deve ter no máximo 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      setSaveLoading(true);
      try {
        if (isMockMode) {
          const profiles = mockStore.getProfiles();
          const idx = profiles.findIndex(p => p.id === currentUser?.id);
          if (idx !== -1) {
            profiles[idx].avatar_url = base64String;
            mockStore.saveProfiles(profiles);
          }
          await new Promise(r => setTimeout(r, 400));
          await loadConfigData();
        } else {
          const { error } = await supabase!
            .from('profiles')
            .update({
              avatar_url: base64String
            })
            .eq('id', currentUser?.id);

          if (error) throw error;
          await loadConfigData();
        }
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profile-updated'));
        }
      } catch (err) {
        console.error('Error updating avatar:', err);
        alert('Erro ao atualizar foto de perfil.');
      } finally {
        setSaveLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  const isUserAdmin = currentUser?.role === 'admin';

  return (
    <div className={styles.wrapper}>
      <div className={styles.gridContainer}>
        
        {/* LEFT COLUMN: Box details + general settings */}
        <div className={styles.leftColumn}>
          
          {/* Card: Box Settings */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Building className={styles.titleIcon} size={18} />
                <span>Dados do Box / Firma</span>
              </h3>
              <p className={styles.cardSubtitle}>Configure os dados operacionais do seu box da CEAGESP</p>
            </div>

            <form onSubmit={handleSaveBoxDetails}>
              {saveSuccess && (
                <div className={`${styles.alert} ${styles.alertSuccess}`}>
                  <Check size={16} />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              )}
              {saveError && (
                <div className={`${styles.alert} ${styles.alertDanger}`}>
                  <AlertCircle size={16} />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nome do Box</label>
                <div className={styles.inputWrapper}>
                  <Building size={16} className={styles.inputIcon} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Ex: Frutas Prime CEAGESP"
                    value={boxName}
                    disabled={!isUserAdmin}
                    onChange={(e) => setBoxName(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Localização (Pavilhão / Box)</label>
                  <div className={styles.inputWrapper}>
                    <MapPin size={16} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Ex: Pavilhão 3, Box 12"
                      value={location}
                      disabled={!isUserAdmin}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Telefone de Contato</label>
                  <div className={styles.inputWrapper}>
                    <Phone size={16} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      className="form-control" 
                      style={{ paddingLeft: '2.5rem' }}
                      placeholder="Ex: (11) 98765-4321"
                      value={phone}
                      disabled={!isUserAdmin}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Limite de Crédito Padrão (Novos Clientes)</label>
                <div className={styles.inputWrapper}>
                  <DollarSign size={16} className={styles.inputIcon} />
                  <input 
                    type="number" 
                    className="form-control" 
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="Ex: 1500"
                    value={defaultLimit || ''}
                    disabled={!isUserAdmin}
                    onChange={(e) => setDefaultLimit(Number(e.target.value))}
                  />
                </div>
                <span className={styles.helpText}>Esse valor será preenchido automaticamente ao cadastrar um novo cliente.</span>
              </div>

              {isUserAdmin && (
                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }} disabled={saveLoading}>
                  {saveLoading ? <span className="loading-spinner"></span> : 'Salvar Alterações'}
                </button>
              )}
            </form>
          </div>

          {/* Card: Optional Features */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Settings className={styles.titleIcon} size={18} />
                <span>Funcionalidades Opcionais</span>
              </h3>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingMeta}>
                <span className={styles.settingLabel}>Controle de Estoque</span>
                <span className={styles.settingDesc}>
                  Se ativado, exige o controle físico de caixas. Vendas deduzem o estoque automaticamente. Se desativado, o estoque é ignorado.
                </span>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={estoqueAtivo}
                  disabled={!isUserAdmin}
                  onChange={(e) => handleToggleEstoque(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>


        </div>

        {/* RIGHT COLUMN: Plans + Team */}
        <div className={styles.rightColumn}>
          
          {/* Card: Billing (Discreet Card) */}
          <div id="subscription-plan" className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <CreditCard className={styles.titleIcon} size={18} />
                <span>Assinatura & Plano</span>
              </h3>
            </div>

            <div className={styles.billingCard}>
              <div className={styles.billingInfo}>
                <div className={styles.billingHeader}>
                  <div className={styles.planStatus}>
                    <Crown size={16} style={{ color: org?.subscription_status === 'active' ? 'var(--warning)' : 'var(--text-muted)' }} />
                    <span className={styles.planNameLabel}>
                      {org?.subscription_status === 'active' ? 'Plano Pro Ativo' : 'Plano Básico (Trial)'}
                    </span>
                  </div>
                  <span className={`badge ${org?.subscription_status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {org?.subscription_status === 'active' ? 'Faturamento Ok' : '14 dias restantes'}
                  </span>
                </div>

                <div className={styles.billingPricing}>
                  <span className={styles.billingPriceSymbol}>R$</span>
                  <span className={styles.billingPriceVal}>
                    {org?.subscription_status === 'active' ? '149' : '0'}
                  </span>
                  <span className={styles.billingPricePeriod}>/mês</span>
                </div>

                <p className={styles.billingDescText}>
                  {org?.subscription_status === 'active' 
                    ? 'Acesso a todos os recursos ilimitados, incluindo emissão de NF-e.' 
                    : 'Período gratuito de experimentação. Faça o upgrade para liberar todos os recursos.'
                  }
                </p>
              </div>

              <div className={styles.billingActions}>
                {org?.subscription_status === 'active' ? (
                  <button 
                    onClick={() => handleUpgradeMock('trial')} 
                    className="btn-secondary" 
                    style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    Mudar para Plano Básico
                  </button>
                ) : (
                  <button 
                    onClick={() => handleUpgradeMock('active')} 
                    className="btn-primary" 
                    style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    Fazer Upgrade para Pro
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card: Team Directory */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 className={styles.cardTitle}>
                  <Users className={styles.titleIcon} size={18} />
                  <span>Membros da Equipe</span>
                </h3>
                <p className={styles.cardSubtitle}>Gerencie os vendedores cadastrados no seu Box</p>
              </div>
              
              {isUserAdmin && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.25rem' }}
                >
                  <Plus size={14} />
                  <span>Novo Membro</span>
                </button>
              )}
            </div>

            <div className={styles.teamList}>
              {team.map((member) => {
                const isSelf = member.id === currentUser?.id;
                return (
                  <div key={member.id} className={styles.teamMember}>
                    <div className={styles.memberInfo}>
                      <div className={`${styles.memberAvatar} ${isSelf ? styles.memberAvatarSelf : ''}`}>
                        {isSelf ? (
                          <label className={styles.avatarUploadLabel} title="Alterar foto de perfil">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAvatarChange} 
                              style={{ display: 'none' }} 
                            />
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.name} className={styles.avatarImg} />
                            ) : (
                              getInitials(member.name)
                            )}
                            <div className={styles.avatarOverlay}>
                              <Camera size={14} />
                            </div>
                          </label>
                        ) : (
                          member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.name} className={styles.avatarImg} />
                          ) : (
                            getInitials(member.name)
                          )
                        )}
                      </div>
                      <div className={styles.memberMeta}>
                        <div className={styles.memberName}>
                          {member.name} {isSelf && <span className={styles.selfLabel}>(você)</span>}
                        </div>
                        <div className={styles.memberSub}>
                          {member.role === 'admin' ? 'Administrador' : 'Vendedor / Operador'}
                        </div>
                        {isSelf && (
                          <label className={styles.changePhotoLink} title="Alterar foto de perfil">
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAvatarChange} 
                              style={{ display: 'none' }} 
                            />
                            Alterar foto
                          </label>
                        )}
                      </div>
                    </div>

                    <div className={styles.memberActions}>
                      {isUserAdmin && (
                        <>
                          <button 
                            className={styles.actionBtn} 
                            title="Editar Cargo/Nome"
                            onClick={() => {
                              setSelectedMember(member);
                              setEditMemberName(member.name);
                              setEditMemberRole(member.role);
                              setIsEditModalOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          
                          {!isSelf && (
                            <button 
                              className={`${styles.actionBtn} ${styles.actionBtnDelete}`} 
                              title="Remover da Equipe"
                              onClick={() => {
                                setSelectedMember(member);
                                setIsDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* ================= MODALS ================= */}

      {/* Modal: ADD MEMBER */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Adicionar Membro na Equipe</h3>
              <button className={styles.modalCloseBtn} onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              {modalError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Nome do vendedor"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cargo / Permissão</label>
                <select 
                  className="form-control"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                >
                  <option value="vendedor">Vendedor / Operador (Apenas Vendas)</option>
                  <option value="admin">Administrador (Acesso total)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">E-mail de Acesso</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="vendedor@empresa.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
                {!isMockMode && (
                  <span className={styles.settingDesc} style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    O novo vendedor receberá um e-mail de convite para criar sua senha e acessar a plataforma.
                  </span>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)} disabled={modalLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? <span className="loading-spinner"></span> : 'Adicionar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: EDIT MEMBER */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Editar Membro da Equipe</h3>
              <button className={styles.modalCloseBtn} onClick={() => {
                setIsEditModalOpen(false);
                setSelectedMember(null);
              }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditMember}>
              {modalError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nome Completo</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editMemberName}
                  onChange={(e) => setEditMemberName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cargo / Permissão</label>
                <select 
                  className="form-control"
                  value={editMemberRole}
                  onChange={(e) => setEditMemberRole(e.target.value as any)}
                  disabled={selectedMember?.id === currentUser?.id} // Don't let user change own role (safety lock)
                >
                  <option value="vendedor">Vendedor / Operador</option>
                  <option value="admin">Administrador</option>
                </select>
                {selectedMember?.id === currentUser?.id && (
                  <span className={styles.helpText}>Você não pode alterar seu próprio cargo administrativo.</span>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn-secondary" onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedMember(null);
                }} disabled={modalLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={modalLoading}>
                  {modalLoading ? <span className="loading-spinner"></span> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: DELETE CONFIRM */}
      {isDeleteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass`} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} />
                <span>Remover Membro?</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedMember(null);
              }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 0' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                Tem certeza que deseja remover <strong>{selectedMember?.name}</strong> da equipe? 
                Este usuário perderá o acesso às vendas e registros deste Box.
              </p>
              {modalError && (
                <div className={`${styles.alert} ${styles.alertDanger}`} style={{ marginTop: '1rem' }}>
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn-secondary" onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedMember(null);
              }} disabled={modalLoading}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={handleDeleteMember} disabled={modalLoading}>
                {modalLoading ? <span className="loading-spinner"></span> : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: RESET CONFIRM */}
      {isResetModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} glass`} style={{ maxWidth: '400px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} />
                <span>Confirmar Reset?</span>
              </h3>
              <button className={styles.modalCloseBtn} onClick={() => setIsResetModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1rem 0' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
                Isso apagará **todas** as modificações de simulação feitas neste navegador, restaurando os produtos, clientes e equipe padrão do BoxHub.
                A página será recarregada.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn-secondary" onClick={() => setIsResetModalOpen(false)} disabled={modalLoading}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={handleResetSimulator} disabled={modalLoading}>
                {modalLoading ? <span className="loading-spinner"></span> : 'Confirmar Reinicialização'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

