'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { Profile, Organization } from '@/lib/types';
import { Sprout, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // User/Org session state
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);

  // Form Fields
  const [boxName, setBoxName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultLimit, setDefaultLimit] = useState('1500');
  const [estoqueAtivo, setEstoqueAtivo] = useState(false);
  const [segment, setSegment] = useState('ambos'); // 'frutas' | 'legumes' | 'ambos'

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        if (isMockMode) {
          const user = mockDb.getCurrentUser();
          const currentOrg = mockDb.getOrg();
          if (!user) {
            router.push('/login');
            return;
          }
          setCurrentUser(user);
          setOrg(currentOrg);
          if (currentOrg) {
            setBoxName(currentOrg.name || '');
            setLocation(currentOrg.settings?.location || '');
            setPhone(currentOrg.settings?.phone || '');
            setDefaultLimit(String(currentOrg.settings?.default_limit || '1500'));
            setEstoqueAtivo(!!currentOrg.settings?.estoque_ativo);
            setSegment(currentOrg.settings?.segment || 'ambos');
          }
        } else {
          const { data: { session } } = await supabase!.auth.getSession();
          if (!session) {
            router.push('/login');
            return;
          }

          const { data: profile } = await supabase!
            .from('profiles')
            .select('*, organizations(*)')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setCurrentUser(profile);
            setOrg(profile.organizations);
            if (profile.organizations) {
              setBoxName(profile.organizations.name || '');
              const settings = profile.organizations.settings || {};
              setLocation(settings.location || '');
              setPhone(settings.phone || '');
              setDefaultLimit(String(settings.default_limit || '1500'));
              setEstoqueAtivo(!!settings.estoque_ativo);
              setSegment(settings.segment || 'ambos');
            }
          } else {
            router.push('/login');
            return;
          }
        }
      } catch (err) {
        console.error('Error loading session in onboarding:', err);
        setError('Erro ao carregar dados da sessão.');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) {
      setError('Organização não identificada.');
      return;
    }
    if (!boxName.trim()) {
      setError('O nome da empresa/firma é obrigatório.');
      return;
    }

    setSaving(true);
    setError(null);

    const limitNum = parseFloat(defaultLimit);

    try {
      if (isMockMode) {
        // Update mock organization details
        mockDb.updateOrg(boxName, {
          estoque_ativo: estoqueAtivo,
          location,
          phone,
          default_limit: isNaN(limitNum) ? 1500 : limitNum,
          segment
        });
        await new Promise(r => setTimeout(r, 800));
      } else {
        const updatedSettings = {
          estoque_ativo: estoqueAtivo,
          location,
          phone,
          default_limit: isNaN(limitNum) ? 1500 : limitNum,
          segment
        };

        const { error: orgErr } = await supabase!
          .from('organizations')
          .update({
            name: boxName,
            settings: updatedSettings
          })
          .eq('id', org.id);

        if (orgErr) throw orgErr;
      }

      // Redirect to main dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error saving onboarding settings:', err);
      setError(err.message || 'Erro ao salvar as configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <div className={`${styles.card} glass`}>
          <div className={styles.header}>
            <div className={styles.logoContainer}>
              <Sprout className={styles.logoIcon} size={32} />
              <span className={styles.logoText}>
                Box<span className={styles.logoHighlight}>Hub</span>
              </span>
            </div>
            <h2 className={styles.title}>Configure sua Empresa</h2>
            <p className={styles.subtitle}>
              Olá, {currentUser?.name}! Vamos definir as informações iniciais para ativar seu painel.
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className="form-label">Nome da Empresa / Firma</label>
              <input
                type="text"
                className="form-control"
                placeholder="ex: Distribuidora Silva"
                value={boxName}
                onChange={(e) => setBoxName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className="form-label">Localização (Pavilhão e Box)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ex: Pavilhão MFE, Box 12"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className={styles.formGroup}>
                <label className="form-label">WhatsApp Comercial</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ex: (11) 98765-4321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className="form-label">Segmento de Venda</label>
                <select
                  className="form-control"
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  disabled={saving}
                >
                  <option value="frutas">Frutas</option>
                  <option value="legumes">Legumes</option>
                  <option value="ambos">Frutas e Legumes</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className="form-label">Limite de Fiado Padrão (R$)</label>
                <input
                  type="number"
                  className="form-control"
                  value={defaultLimit}
                  onChange={(e) => setDefaultLimit(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.switchRow}>
              <div className={styles.switchMeta}>
                <span className={styles.switchLabel}>Controle de Estoque Físico</span>
                <span className={styles.switchDesc}>
                  Ativa o gerenciamento e baixa automática de caixas de frutas e legumes em estoque.
                </span>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={estoqueAtivo}
                  onChange={(e) => setEstoqueAtivo(e.target.checked)}
                  disabled={saving}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={saving}>
              {saving ? (
                <span className="loading-spinner"></span>
              ) : (
                <>
                  <span>Concluir e Acessar Painel</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
