'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, CRM_BRANDING } from '@/lib/supabase';
import { Sprout, Lock, AlertCircle, Check, Key, Eye, EyeOff } from 'lucide-react';
import styles from './welcome.module.css';

export default function WelcomePage() {
  const router = useRouter();
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribeFn: (() => void) | undefined;
    let timer: NodeJS.Timeout | undefined;

    const loadUserProfile = async (userId: string) => {
      try {
        const { data: userProfile, error: profileErr } = await supabase!
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', userId)
          .single();

        if (!active) return;

        if (profileErr || !userProfile) {
          setError('Não encontramos as informações da sua conta. Fale com seu administrador.');
        } else {
          setProfile(userProfile);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
        if (active) setError('Erro ao carregar as informações do seu perfil.');
      } finally {
        if (active) setSessionLoading(false);
      }
    };

    const run = async () => {
      if (isMockMode) {
        setError('O modo de demonstração local está ativo. Para testar convites reais por e-mail, configure as credenciais do Supabase no .env.local.');
        setSessionLoading(false);
        return;
      }

      // Check current session
      const { data: { session: currentSession } } = await supabase!.auth.getSession();
      if (currentSession) {
        if (active) await loadUserProfile(currentSession.user.id);
        return;
      }

      // Set up onAuthStateChange listener
      const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
        if (session && active) {
          await loadUserProfile(session.user.id);
          if (unsubscribeFn) unsubscribeFn();
        }
      });
      
      unsubscribeFn = () => subscription.unsubscribe();

      // Fallback timeout in case the hash is invalid/expired/missing
      timer = setTimeout(() => {
        if (active) {
          setError('Link de convite inválido, expirado ou você já o utilizou. Por favor, solicite um novo convite ao administrador do Box.');
          setSessionLoading(false);
          if (unsubscribeFn) unsubscribeFn();
        }
      }, 5000);
    };

    run();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (unsubscribeFn) unsubscribeFn();
    };
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Update password using Supabase Auth
      const { error: updateErr } = await supabase!.auth.updateUser({
        password: password
      });

      if (updateErr) throw updateErr;

      setSuccess(true);
      
      // Delay redirect to show success state
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (err: any) {
      console.error('Error setting password:', err);
      setError(err.message || 'Erro ao definir a senha. Tente novamente.');
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={`${styles.container} glass`}>
          <div className={styles.loaderWrapper}>
            <div className="loading-spinner"></div>
            <p className={styles.subtitle}>Verificando seu convite...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} glass animate-fade-in`}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            {profile?.organizations?.settings?.logo_url ? (
              <>
                <img
                  src={profile.organizations.settings.logo_url}
                  alt={profile.organizations.name}
                  style={{ maxWidth: '160px', maxHeight: '40px', objectFit: 'contain' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                  <img src={CRM_BRANDING.logoIcon} alt="BoxHub" style={{ width: '12px', height: '12px' }} />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>BoxHub</span>
                </div>
              </>
            ) : (
              <>
                <img
                  src={CRM_BRANDING.logoLight}
                  alt="BoxHub"
                  className={styles.logoLightOnly}
                />
                <img
                  src={CRM_BRANDING.logoDark}
                  alt="BoxHub"
                  className={styles.logoDarkOnly}
                />
              </>
            )}
          </div>
          <h2 className={styles.title}>Definir Senha de Acesso</h2>
          {profile && (
            <p className={styles.subtitle}>
              Olá, <strong>{profile.name}</strong>! Você foi adicionado como <strong>{profile.role === 'admin' ? 'Administrador' : 'Vendedor'}</strong> na firma <strong>{profile.organizations?.name}</strong>. Escolha sua senha para começar.
            </p>
          )}
        </div>

        {error && (
          <div className={`${styles.alert} ${styles.alertDanger}`} style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginBottom: '1.5rem' }}>
            <Check size={16} style={{ flexShrink: 0 }} />
            <span>Senha configurada com sucesso! Redirecionando...</span>
          </div>
        )}

        {profile && !success && (
          <form onSubmit={handleSetPassword} className={styles.form}>
            <div className="form-group">
              <label className="form-label">Nova Senha</label>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <Lock size={16} className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-control" 
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Mínimo 6 caracteres"
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar Nova Senha</label>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <Key size={16} className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  className="form-control" 
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Repita a senha"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', height: '44px' }}>
              {loading ? <span className="loading-spinner"></span> : 'Confirmar e Acessar'}
            </button>
          </form>
        )}

        {error && !profile && (
          <button 
            onClick={() => router.push('/login')} 
            className="btn-secondary" 
            style={{ width: '100%', justifyContent: 'center', height: '44px' }}
          >
            Ir para a página de Login
          </button>
        )}
      </div>
    </div>
  );
}
