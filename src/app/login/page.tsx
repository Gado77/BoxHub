'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore, CRM_BRANDING } from '@/lib/supabase';
import { Lock, Mail, User, Building, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'recovery'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [boxName, setBoxName] = useState('');
  
  // Loading, error & success states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDev(
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.startsWith('192.168.')
      );
    }
  }, []);

  // Check if already logged in (redirect to dashboard)
  useEffect(() => {
    let active = true;
    let unsubscribeFn: (() => void) | undefined;

    const checkUser = async () => {
      if (isMockMode) {
        // If mock user set, go to dashboard
        if (typeof window !== 'undefined' && localStorage.getItem('boxhub_current_user_id')) {
          router.push('/dashboard');
        }
      } else {
        // Detect recovery/invite type directly from URL hash/query on mount
        let isRecovery = false;
        let isInvite = false;
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          const search = window.location.search;
          isRecovery = hash.includes('type=recovery') || search.includes('type=recovery');
          isInvite = hash.includes('type=invite') || search.includes('type=invite') || hash.includes('type=signup') || search.includes('type=signup');
        }

        // 1. Check current session immediately
        const { data } = await supabase!.auth.getSession();
        if (data.session && active) {
          if (isRecovery) {
            router.push('/reset-password');
          } else if (isInvite) {
            router.push('/welcome');
          } else {
            router.push('/dashboard');
          }
          return;
        }

        // 2. Set up listener to catch session after async code exchange/hash parsing
        const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
          if (session && active) {
            if (isRecovery) {
              router.push('/reset-password');
            } else if (isInvite) {
              router.push('/welcome');
            } else {
              router.push('/dashboard');
            }
            if (unsubscribeFn) unsubscribeFn();
          }
        });
        
        unsubscribeFn = () => subscription.unsubscribe();
      }
    };
    checkUser();

    return () => {
      active = false;
      if (unsubscribeFn) unsubscribeFn();
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isMockMode) {
        // Simulation login
        // Find if profile exists, otherwise create it or use default
        const profiles = mockStore.getProfiles();
        // Just let them log in with anything for testing, matching by email or fallback
        const existing = profiles.find(p => p.name.toLowerCase().includes(email.split('@')[0].toLowerCase()));
        if (existing) {
          mockDb.setCurrentUser(existing.id);
        } else {
          // If admin logging in, select admin. If carlos, Carlos. Otherwise select first profile.
          mockDb.setCurrentUser(profiles[0].id);
        }
        
        // Wait a bit to simulate API
        await new Promise(r => setTimeout(r, 600));
        router.push('/dashboard');
      } else {
        const { error: authErr } = await supabase!.auth.signInWithPassword({
          email,
          password
        });
        if (authErr) throw authErr;
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!boxName.trim() || !name.trim()) {
      setError('Por favor, preencha todos os campos.');
      setLoading(false);
      return;
    }

    try {
      if (isMockMode) {
        // Create simulated organization and profile
        const orgs = mockStore.getOrgs();
        const newOrgId = `org-${Date.now()}`;
        orgs.push({
          id: newOrgId,
          name: boxName,
          stripe_customer_id: null,
          subscription_status: 'trial',
          settings: { estoque_ativo: false }
        });
        mockStore.saveOrgs(orgs);

        const profiles = mockStore.getProfiles();
        const newUserId = `usr-${Date.now()}`;
        profiles.push({
          id: newUserId,
          organization_id: newOrgId,
          name: `${name} (Admin)`,
          role: 'admin'
        });
        mockStore.saveProfiles(profiles);

        // Login as new user
        mockDb.setCurrentUser(newUserId);
        
        await new Promise(r => setTimeout(r, 800));
        router.push('/onboarding');
      } else {
        // Sign up user via supabase
        const { data, error: authErr } = await supabase!.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });
        if (authErr) throw authErr;
        if (!data.user) {
          throw new Error(
            'A confirmação de e-mail está ativada no seu Supabase. Para que o cadastro de novos boxes funcione corretamente (criando a empresa e o perfil de administrador), você precisa DESATIVAR a confirmação de e-mail no painel do Supabase. Vá em: Authentication -> Providers -> Email -> e desative a opção "Confirm email".'
          );
        }

        // Generate organization ID client-side to bypass RLS select-during-insert catch-22
        const orgId = typeof window !== 'undefined' && window.crypto?.randomUUID 
          ? window.crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = Math.random() * 16 | 0;
              const v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });

        // We'll create organization first
        const { error: orgErr } = await supabase!
          .from('organizations')
          .insert({ id: orgId, name: boxName });
        if (orgErr) throw orgErr;

        // Determine role based on email context for testing/superadmin access
        const isSuperAdmin = email.toLowerCase().includes('superadmin');

        // Then profile
        const { error: profErr } = await supabase!
          .from('profiles')
          .insert({
            id: data.user.id,
            organization_id: orgId,
            name: name,
            role: isSuperAdmin ? 'superadmin' : 'admin',
            email: email
          });
        if (profErr) throw profErr;

        router.push('/onboarding');
      }
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setError(err.message || 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 600));
        setSuccessMsg('Modo de simulação: E-mail de redefinição enviado com sucesso!');
      } else {
        const { error: recoveryErr } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (recoveryErr) throw recoveryErr;
        setSuccessMsg('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar e-mail de recuperação. Verifique o endereço digitado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} glass animate-fade-in`}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img 
              src={CRM_BRANDING.logoDark} 
              alt="BoxHub Logo" 
              className={styles.logoImage} 
            />
          </div>
          <p className={styles.tagline}>Gestão que colhe resultados.</p>
        </div>

        {activeTab !== 'recovery' && (
          <div className={styles.tabs}>
            <button 
              type="button"
              className={`${styles.tab} ${activeTab === 'login' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); setShowPassword(false); setShowRegPassword(false); }}
            >
              Entrar
            </button>
            <button 
              type="button"
              className={`${styles.tab} ${activeTab === 'register' ? styles.activeTab : ''}`}
              onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); setShowPassword(false); setShowRegPassword(false); }}
            >
              Cadastrar Box
            </button>
          </div>
        )}

        {error && (
          <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="badge badge-success" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
            <Check size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem' }}>{successMsg}</span>
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="email"
                  type="email" 
                  className="form-control" 
                  placeholder="seuemail@exemplo.com"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="password"
                  type={showPassword ? 'text' : 'password'} 
                  className="form-control" 
                  placeholder="••••••••"
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('recovery'); setError(null); setSuccessMsg(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : 'Acessar Conta'}
            </button>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label" htmlFor="boxName">Nome do Box/Firma</label>
              <div style={{ position: 'relative' }}>
                <Building size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="boxName"
                  type="text" 
                  className="form-control" 
                  placeholder="ex: Frutas Silva Ltda"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={boxName}
                  onChange={(e) => setBoxName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="name">Seu Nome completo</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="name"
                  type="text" 
                  className="form-control" 
                  placeholder="ex: Roberto Silva"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">E-mail de Trabalho</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="reg-email"
                  type="email" 
                  className="form-control" 
                  placeholder="seuemail@exemplo.com"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Senha de Acesso</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="reg-password"
                  type={showRegPassword ? 'text' : 'password'} 
                  className="form-control" 
                  placeholder="Mínimo 6 caracteres"
                  style={{ paddingLeft: '40px', paddingRight: '40px' }}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  title={showRegPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : 'Criar Conta e Iniciar'}
            </button>
          </form>
        )}

        {activeTab === 'recovery' && (
          <form onSubmit={handleRecovery}>
            <p className={styles.tagline} style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
              Digite seu e-mail abaixo. Enviaremos um link para você redefinir sua senha.
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="recovery-email">E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  id="recovery-email"
                  type="email" 
                  className="form-control" 
                  placeholder="seuemail@exemplo.com"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : 'Enviar Link de Recuperação'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button 
                type="button" 
                onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--primary)', 
                  fontWeight: '600', 
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {isDev && !isMockMode && (
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-muted)', 
            background: 'rgba(255, 255, 255, 0.03)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '6px', 
            padding: '0.6rem 0.8rem',
            lineHeight: '1.4',
            marginTop: '1.25rem',
            marginBottom: '1.25rem',
            width: '100%',
            textAlign: 'left'
          }}>
            <strong>Dica de Desenvolvimento (SuperAdmin):</strong> 
            <br />
            • Para criar a sua conta de SuperAdmin pela primeira vez no Supabase real, vá na aba <strong>Cadastrar Box</strong> e crie uma conta usando um e-mail que contenha a palavra <code>superadmin</code>.
            <br />
            • Se você já criou a conta em outro dispositivo, <strong>basta fazer o login normalmente</strong> digitando o e-mail e senha no formulário acima (aba "Entrar") e clicar em "Acessar Conta".
          </div>
        )}



        <div className={styles.loginFooter}>
          <a href="/termos" className={styles.footerLink}>Termos de Uso</a>
          <span className={styles.footerDivider}>•</span>
          <a href="/privacidade" className={styles.footerLink}>Política de Privacidade & LGPD</a>
        </div>

      </div>
    </div>
  );
}
