'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { Organization, Profile, Subscription } from '@/lib/types';
import Modal from '@/components/Modal';
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

const formatAuditLog = (log: any) => {
  const dateStr = new Date(log.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let message = '';
  const meta = log.metadata || {};

  switch (log.action) {
    case 'cancel_sale':
      message = `Venda de R$ ${Number(meta.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no ${String(meta.payment_method || 'fiado').toUpperCase()} foi cancelada.`;
      break;
    case 'create_fiado_payment':
      message = `Pagamento de fiado de R$ ${Number(meta.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no ${String(meta.payment_method || 'pix').toUpperCase()} registrado.`;
      break;
    case 'add_member':
      message = `Membro "${meta.name}" convidado como ${meta.role === 'admin' ? 'Administrador' : 'Vendedor'}.`;
      break;
    case 'update_member':
      message = `Membro "${meta.new_name}" alterado de ${meta.old_role === 'admin' ? 'Admin' : 'Vendedor'} para ${meta.new_role === 'admin' ? 'Admin' : 'Vendedor'}.`;
      break;
    case 'remove_member':
      message = `Membro "${meta.name}" (${meta.role === 'admin' ? 'Admin' : 'Vendedor'}) removido da equipe.`;
      break;
    case 'update_organization':
      message = `Dados do Box atualizados. Nome: "${meta.new_name}".`;
      break;
    case 'update_subscription':
      message = `Assinatura de faturamento atualizada para Plano ${String(meta.new_plan || 'Pro').toUpperCase()} (${meta.new_billing_cycle === 'annual' ? 'Anual' : 'Mensal'}).`;
      break;
    default:
      message = `${log.action} em ${log.entity}.`;
  }

  return { message, dateStr };
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [org, setOrg] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [estoqueAtivo, setEstoqueAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Box Details Form State
  const [boxName, setBoxName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultLimit, setDefaultLimit] = useState<number>(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Logo State
  const [logoUrl, setLogoUrl] = useState('');

  // Modal Visibility States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selected Member for Edit/Delete
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);

  // Form states for Add/Edit Member
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'vendedor' | 'superadmin'>('vendedor');
  const [editMemberName, setEditMemberName] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<'admin' | 'vendedor' | 'superadmin'>('vendedor');
  const [invitedViaEmail, setInvitedViaEmail] = useState(false);

  // Image Cropping States
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgRatio, setImgRatio] = useState(1);

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
        const currentSub = mockDb.subscriptions.get();

        setOrg(currentOrg);
        setCurrentUser(user);
        setTeam(profiles);
        setSubscription(currentSub);
        setEstoqueAtivo(currentOrg.settings?.estoque_ativo || false);

        setBoxName(currentOrg.name || '');
        setLocation(currentOrg.settings?.location || '');
        setPhone(currentOrg.settings?.phone || '');
        setDefaultLimit(currentOrg.settings?.default_limit || 0);
        setLogoUrl(currentOrg.settings?.logo_url || '');
        
        if (user && user.role === 'admin') {
          setAuditLogs(mockDb.auditLogs.list());
        }
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
          setLogoUrl(profile.organizations.settings?.logo_url || '');

          const { data: profiles } = await supabase!
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          setTeam(profiles || []);

          const { data: subData } = await supabase!
            .from('subscriptions')
            .select('*')
            .eq('company_id', profile.organization_id)
            .single();

          setSubscription(subData || null);

          if (profile && profile.role === 'admin') {
            const { data: logsData } = await supabase!
              .from('audit_logs')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(20);
            setAuditLogs(logsData || []);
          }
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

  // Lógica para obter a quantidade de dias restantes de trial
  const getTrialDaysRemaining = () => {
    if (subscription && subscription.trial_ends_at) {
      const ends = new Date(subscription.trial_ends_at).getTime();
      const now = new Date().getTime();
      const diffTime = ends - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    
    if (org && org.created_at) {
      const created = new Date(org.created_at).getTime();
      const ends = created + 7 * 24 * 60 * 60 * 1000;
      const now = new Date().getTime();
      const diffTime = ends - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    
    return 0;
  };

  // Update Inventory Toggle setting immediately
  const handleToggleEstoque = async (checked: boolean) => {
    setEstoqueAtivo(checked);
    try {
      if (isMockMode) {
        mockDb.updateOrgSettings(checked);
      } else {
        if (!org) return;
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
    if (!org) {
      setSaveError('Organização não carregada.');
      return;
    }
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
    if (!org) {
      setModalError('Organização não carregada.');
      return;
    }
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
        mockDb.profiles.insert(newMemberName, newMemberRole, newMemberEmail);
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
        setInvitedViaEmail(data.invitedViaEmail || false);
        setMemberPassword(data.defaultPassword || '');
        await loadConfigData();
        return; // keeps modal open to show password/invite details
      }

      // Reset and close (mock mode only)
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('vendedor');
      setMemberPassword('');
      setInvitedViaEmail(false);
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
    if (!selectedMember) return;
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
      window.location.reload();
    } catch (err) {
      console.error(err);
      setModalLoading(false);
    }
  };

  // Redireciona para o painel de planos
  const handleBillingAction = () => {
    router.push('/dashboard/planos');
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading('portal');
      setSaveError('');

      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 600));
        // Alternar trial/active no mock localmente
        const isCurrentActive = subscription?.status === 'active';
        mockDb.subscriptions.update({
          status: isCurrentActive ? 'trialing' : 'active',
        });
        await loadConfigData();
      } else {
        const res = await fetch('/api/stripe/customer-portal', {
          method: 'POST',
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erro ao acessar o portal de faturamento.');
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('Erro ao carregar o portal do faturamento.');
        }
      }
    } catch (err: any) {
      console.error('Erro ao acessar portal Stripe:', err);
      setSaveError(err.message || 'Erro ao carregar configurações de pagamento.');
    } finally {
      setActionLoading(null);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Dragging event handlers for the cropper using PointerEvents (responsive mouse + touch)
  const getConstrainedPosition = (x: number, y: number, currentZoom: number, ratio: number) => {
    const w = (ratio > 1 ? 250 * ratio : 250) * currentZoom;
    const h = (ratio > 1 ? 250 : 250 / ratio) * currentZoom;

    const minX = 125 - w / 2;
    const maxX = w / 2 - 125;
    const minY = 125 - h / 2;
    const maxY = h / 2 - 125;

    const clampedX = minX > maxX ? 0 : Math.min(Math.max(x, minX), maxX);
    const clampedY = minY > maxY ? 0 : Math.min(Math.max(y, minY), maxY);

    return { x: clampedX, y: clampedY };
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setPosition((prev) => getConstrainedPosition(prev.x, prev.y, newZoom, imgRatio));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const constrained = getConstrainedPosition(newX, newY, zoom, imgRatio);
    setPosition(constrained);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleConfirmCrop = () => {
    const imageEl = document.getElementById('cropPreviewImage') as HTMLImageElement;
    if (!imageEl) return;

    setSaveLoading(true);

    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // 1. Fill background with white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 500, 500);

      // 2. Translate origin to center of canvas
      ctx.translate(250, 250);

      // 3. Apply position offsets and zoom scale
      // Viewport size on screen is 250px. Canvas size is 500px.
      // So multiplier is 500 / 250 = 2.
      const scaleMultiplier = 500 / 250;
      ctx.translate(position.x * scaleMultiplier, position.y * scaleMultiplier);
      ctx.scale(zoom * scaleMultiplier, zoom * scaleMultiplier);

      // 4. Calculate cover dimensions centered
      const imgRatio = imageEl.naturalWidth / imageEl.naturalHeight;
      let initialWidth = 250;
      let initialHeight = 250;
      if (imgRatio > 1) {
        initialWidth = 250 * imgRatio;
      } else {
        initialHeight = 250 / imgRatio;
      }

      ctx.drawImage(
        imageEl,
        -initialWidth / 2,
        -initialHeight / 2,
        initialWidth,
        initialHeight
      );
    }

    const base64String = canvas.toDataURL('image/jpeg', 0.90);

    const saveCroppedAvatar = async () => {
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
            .update({ avatar_url: base64String })
            .eq('id', currentUser?.id);

          if (error) throw error;
          await loadConfigData();
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profile-updated'));
        }

        setIsCropModalOpen(false);
      } catch (err) {
        console.error('Error updating avatar:', err);
        alert('Erro ao atualizar foto de perfil.');
      } finally {
        setSaveLoading(false);
      }
    };

    saveCroppedAvatar();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImageUrl(reader.result as string);
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setImgRatio(1);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

          {/* Card: Logo da Empresa */}
          <div className={`${styles.card} glass`}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                <Camera className={styles.titleIcon} size={18} />
                <span>Logo da Empresa</span>
              </h3>
              <p className={styles.cardSubtitle}>Sua marca aparece na sidebar, mobile header e página de boas-vindas.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {org?.settings?.logo_url ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <img src={org.settings.logo_url} alt="logo" style={{ maxWidth: '140px', maxHeight: '36px', objectFit: 'contain' }} />
                  {isUserAdmin && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                      onClick={async () => {
                        if (isMockMode) {
                          mockDb.updateOrgLogo('');
                          await loadConfigData();
                        } else {
                          const updatedSettings = { ...org.settings, logo_url: '' };
                          await supabase!.from('organizations').update({ settings: updatedSettings }).eq('id', org.id);
                          await loadConfigData();
                        }
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <Camera size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Nenhuma logo cadastrada</p>
                  {isUserAdmin && (
                    <label className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <Camera size={14} />
                      <span>Selecionar Imagem</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={!isUserAdmin || saveLoading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!org) return;
                          if (file.size > 2 * 1024 * 1024) {
                            alert('A imagem deve ter no máximo 2MB.');
                            return;
                          }
                          setSaveLoading(true);
                          setSaveError('');
                          try {
                            if (isMockMode) {
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                mockDb.updateOrgLogo(reader.result as string);
                                await new Promise(r => setTimeout(r, 400));
                                await loadConfigData();
                                setSaveSuccess(true);
                                setTimeout(() => setSaveSuccess(false), 3000);
                                setSaveLoading(false);
                              };
                              reader.readAsDataURL(file);
                            } else {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `logo-${org.id}.${fileExt}`;
                              const { data: uploadData, error: uploadError } = await supabase!
                                .storage
                                .from('Arquivos')
                                .upload(`logos/${fileName}`, file, { upsert: true });
                              if (uploadError) throw uploadError;
                              const { data: { publicUrl } } = supabase!
                                .storage
                                .from('Arquivos')
                                .getPublicUrl(`logos/${fileName}`);
                              await supabase!
                                .from('organizations')
                                .update({ settings: { ...org.settings, logo_url: publicUrl } })
                                .eq('id', org.id);
                              await loadConfigData();
                              setSaveSuccess(true);
                              setTimeout(() => setSaveSuccess(false), 3000);
                              setSaveLoading(false);
                            }
                          } catch (err: any) {
                            setSaveError(err.message || 'Erro ao fazer upload da logo.');
                            setSaveLoading(false);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              )}

              {saveSuccess && (
                <div className={`${styles.alert} ${styles.alertSuccess}`}>
                  <Check size={16} />
                  <span>Logo salva com sucesso!</span>
                </div>
              )}
              {saveError && (
                <div className={`${styles.alert} ${styles.alertDanger}`}>
                  <AlertCircle size={16} />
                  <span>{saveError}</span>
                </div>
              )}
            </div>
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

          {/* Card: Audit Logs (Admins only) */}
          {isUserAdmin && (
            <div className={`${styles.card} glass`}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  <ShieldCheck className={styles.titleIcon} size={18} />
                  <span>Histórico de Auditoria</span>
                </h3>
                <p className={styles.cardSubtitle}>Eventos e alterações de segurança recentes no Box</p>
              </div>

              <div className={styles.auditList}>
                {auditLogs.length === 0 ? (
                  <p className={styles.emptyAuditText}>Nenhum registro de auditoria disponível.</p>
                ) : (
                  auditLogs.map((log) => {
                    const { message, dateStr } = formatAuditLog(log);
                    return (
                      <div key={log.id} className={styles.auditItem}>
                        <div className={styles.auditMeta}>
                          <span className={styles.auditDate}>{dateStr}</span>
                        </div>
                        <p className={styles.auditMsg}>{message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Card: Danger Zone (Mock Mode only) */}
          {isMockMode && isUserAdmin && (
            <div className={`${styles.card} glass`} style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle} style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle className={styles.titleIcon} size={18} style={{ color: 'var(--danger)' }} />
                  <span>Zona de Perigo (Sandbox)</span>
                </h3>
              </div>
              <div className={styles.settingRow} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div className={styles.settingMeta}>
                  <span className={styles.settingLabel} style={{ color: 'var(--danger)' }}>Reiniciar Dados de Simulação</span>
                  <span className={styles.settingDesc}>
                    Apaga todas as empresas, vendas, clientes e estoques salvos no armazenamento local deste navegador, restaurando o estado original de testes.
                  </span>
                </div>
                <button 
                  type="button" 
                  className="btn-danger" 
                  onClick={() => setIsResetModalOpen(true)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Reiniciar Dados
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Plans + Team */}
        <div className={styles.rightColumn}>
          
          {/* Card: Billing (Discreet Card) */}
          {isUserAdmin && (() => {
            const trialDaysLeft = getTrialDaysRemaining();
            const isTrialActive = subscription 
              ? (subscription.status === 'trialing' && trialDaysLeft > 0) 
              : (trialDaysLeft > 0);
            
            const billingCycleText = subscription?.billing_cycle === 'annual' ? 'Anual' : 'Mensal';
            
            const planName = subscription 
              ? `${subscription.plan === 'pro' ? 'Plano Pro' : subscription.plan === 'enterprise' ? 'Plano Enterprise' : 'Plano Básico'} (${billingCycleText})` 
              : (isTrialActive ? 'Plano Pro (Trial - Mensal)' : 'Sem plano ativo');
            
            const statusLabel = subscription 
              ? (subscription.status === 'active' ? 'Assinatura Ativa' : subscription.status === 'trialing' ? 'Período de Testes' : `Assinatura ${subscription.status}`)
              : (isTrialActive ? 'Período de Testes' : 'Faturamento Pendente');
            
            const badgeClass = subscription?.status === 'active' 
              ? 'badge-success' 
              : (isTrialActive ? 'badge-warning' : 'badge-danger');
            
            let priceVal = '0';
            if (subscription) {
              if (subscription.plan === 'pro') {
                priceVal = subscription.billing_cycle === 'annual' ? '247,50' : '297';
              } else if (subscription.plan === 'basic') {
                priceVal = subscription.billing_cycle === 'annual' ? '122,50' : '147';
              }
            } else if (isTrialActive) {
              priceVal = '297';
            }
            
            const descText = isTrialActive 
              ? `Você está testando os recursos do BoxHub gratuitamente no período de testes. Restam ${trialDaysLeft} dias de teste.` 
              : subscription?.status === 'active' 
              ? 'Sua conta está ativa e regularizada com faturamento via Stripe. Acesso total a recursos ilimitados.' 
              : `Sua assinatura está ${subscription?.status || 'inativa'}. Regularize ou escolha um plano de faturamento.`;

            return (
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
                        <Crown size={16} style={{ color: subscription?.status === 'active' || isTrialActive ? 'var(--warning)' : 'var(--text-muted)' }} />
                        <span className={styles.planNameLabel}>{planName}</span>
                      </div>
                      <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                    </div>

                    <div className={styles.billingPricing}>
                      <span className={styles.billingPriceSymbol}>R$</span>
                      <span className={styles.billingPriceVal}>{priceVal}</span>
                      <span className={styles.billingPricePeriod}>/mês</span>
                    </div>

                    <p className={styles.billingDescText}>{descText}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', width: '100%' }}>
                    {subscription && ['active', 'past_due', 'unpaid'].includes(subscription.status) && (
                      <button 
                        onClick={handleManageBilling} 
                        className="btn-primary" 
                        disabled={actionLoading !== null}
                        style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center' }}
                      >
                        {actionLoading === 'portal' ? (
                          <span className="loading-spinner"></span>
                        ) : (
                          <>
                            <CreditCard size={14} />
                            <span>Gerenciar Assinatura (Stripe)</span>
                          </>
                        )}
                      </button>
                    )}
                    
                    <button 
                      onClick={handleBillingAction} 
                      className={subscription?.status === 'active' ? "btn-secondary" : "btn-primary"} 
                      style={{ width: '100%', fontSize: '0.85rem', justifyContent: 'center' }}
                    >
                      Ver Planos e Preços
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
              
              {isUserAdmin && (() => {
                const userLimit = subscription?.plan === 'basic' ? 2 : 999;
                const hasReachedUserLimit = team.length >= userLimit;
                return (
                  <button 
                    onClick={() => {
                      if (hasReachedUserLimit) {
                        setIsUpgradeModalOpen(true);
                      } else {
                        setMemberPassword('');
                        setInvitedViaEmail(false);
                        setModalError('');
                        setIsAddModalOpen(true);
                      }
                    }}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.25rem' }}
                  >
                    <Plus size={14} />
                    <span>Novo Membro</span>
                  </button>
                );
              })()}
            </div>

            {(() => {
              const userLimit = subscription?.plan === 'basic' ? 2 : 999;
              const exceedsLimit = team.length > userLimit;
              if (exceedsLimit) {
                return (
                  <div className={`${styles.alert} ${styles.alertWarning}`} style={{ margin: '1rem', padding: '0.75rem 1rem' }}>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>Limite de equipe excedido:</strong> Sua equipe tem {team.length} membros, mas seu plano Básico suporta apenas {userLimit}. Os vendedores adicionais continuarão operando normalmente, mas você não poderá adicionar novos membros. Faça upgrade para o Pro para regularizar.
                    </span>
                  </div>
                );
              }
              return null;
            })()}

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

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setInvitedViaEmail(false); }}
        title="Adicionar Membro na Equipe"
      >

            {invitedViaEmail || memberPassword ? (
              <div style={{ padding: '0.5rem 0' }}>
                <div className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginBottom: '1rem' }}>
                  <Check size={16} />
                  <span>{invitedViaEmail ? 'Convite enviado com sucesso!' : 'Membro adicionado com sucesso!'}</span>
                </div>

                {invitedViaEmail ? (
                  <p style={{ marginBottom: '1.5rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
                    Um e-mail de convite foi enviado para <strong>{newMemberEmail}</strong>. 
                    O novo membro receberá as instruções para definir sua senha de acesso e ativar a conta.
                  </p>
                ) : (
                  <>
                    <p style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                      Compartilhe as credenciais abaixo com <strong>{newMemberName}</strong>:
                    </p>

                    <div style={{ 
                      background: 'var(--bg-main)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-md)', 
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>E-mail</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', wordBreak: 'break-all' }}>{newMemberEmail}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Senha padrão</span>
                        <div style={{ 
                          fontWeight: 700, 
                          color: 'var(--primary)', 
                          fontSize: '1.1rem', 
                          fontFamily: 'monospace',
                          letterSpacing: '1px'
                        }}>{memberPassword}</div>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      O membro pode alterar a senha depois de acessar o painel.
                    </p>
                  </>
                )}

                <div className={styles.modalFooter}>
                  <button type="button" className="btn-primary" onClick={() => {
                    setNewMemberName('');
                    setNewMemberEmail('');
                    setNewMemberRole('vendedor');
                    setMemberPassword('');
                    setInvitedViaEmail(false);
                    setIsAddModalOpen(false);
                  }}>
                    Ok, entendi
                  </button>
                </div>
              </div>
            ) : (
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
            )}
      </Modal>

      {/* Modal: EDIT MEMBER */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedMember(null);
        }}
        title="Editar Membro da Equipe"
      >

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
      </Modal>

      {/* Modal: DELETE CONFIRM */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedMember(null);
        }}
        title="Remover Membro?"
      >

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
      </Modal>

      {/* Modal: RESET CONFIRM */}
      <Modal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
        title="Confirmar Reset?"
      >
        <div style={{ padding: '0.5rem 0' }}>
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
      </Modal>

      {/* Modal: CONTEXTUAL UPGRADE */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Seu time está crescendo! 🚀"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            Faça upgrade para o <strong>Plano Pro</strong> e desbloqueie:
          </p>
          <ul style={{ 
            listStyleType: 'none', 
            padding: 0, 
            margin: '0 0 1.5rem 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Usuários ilimitados</strong> (atualmente limitado a 2)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Múltiplos pipelines</strong> para organizar suas vendas</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
              <span><strong>Relatórios avançados</strong> e insights automáticos</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>
              <span>Suporte prioritário e automações futuras</span>
            </li>
          </ul>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Transição rápida e segura pelo Stripe. Seus dados existentes estão 100% protegidos.
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => setIsUpgradeModalOpen(false)}
          >
            Voltar
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={() => {
              setIsUpgradeModalOpen(false);
              router.push('/dashboard/planos');
            }}
          >
            Fazer Upgrade
          </button>
        </div>
      </Modal>

      {/* Modal: PHOTO CROP EDITOR */}
      <Modal
        isOpen={isCropModalOpen}
        onClose={() => {
          if (!saveLoading) setIsCropModalOpen(false);
        }}
        title="Editar Foto de Perfil"
      >

            <div className={styles.cropContainer}>
              <div 
                className={styles.cropViewport}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <img 
                  id="cropPreviewImage"
                  src={cropImageUrl} 
                  alt="Recorte" 
                  className={styles.cropImage}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImgRatio(img.naturalWidth / img.naturalHeight);
                  }}
                  style={{
                    width: imgRatio > 1 ? 'auto' : '100%',
                    height: imgRatio > 1 ? '100%' : 'auto',
                    transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  }}
                  draggable={false}
                />
                <div className={styles.cropGridOverlay}></div>
                <div className={styles.cropGridLines}></div>
              </div>

              <div className={styles.zoomControls}>
                <span className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zoom</span>
                <div className={styles.zoomSliderWrapper}>
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    step="0.01" 
                    value={zoom}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                    className={styles.zoomSlider}
                  />
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setIsCropModalOpen(false)} 
                disabled={saveLoading}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleConfirmCrop} 
                disabled={saveLoading}
              >
                {saveLoading ? <span className="loading-spinner"></span> : 'Confirmar'}
              </button>
            </div>
      </Modal>

    </div>
  );
}

