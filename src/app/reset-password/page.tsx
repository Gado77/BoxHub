'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, CRM_BRANDING } from '@/lib/supabase';
import { Lock, AlertCircle, Check, Key, Eye, EyeOff } from 'lucide-react';
import styles from '../welcome/welcome.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionLoading, setSessionLoading] = useState(true);
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

    const checkSession = async () => {
      if (isMockMode) {
        setError('O modo de demonstração local está ativo. Para testar a redefinição de senha real, configure o Supabase.');
        setSessionLoading(false);
        return;
      }

      // Check if there is a 'code' parameter in the URL (PKCE flow redirect)
      let code: string | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        code = urlParams.get('code');
      }

      if (code) {
        try {
          const { data, error: exchangeErr } = await supabase!.auth.exchangeCodeForSession(code);
          if (exchangeErr) throw exchangeErr;
          
          if (active && data.session) {
            setSessionLoading(false);
          } else {
            throw new Error('Sessão não pôde ser estabelecida.');
          }
          return;
        } catch (err: any) {
          console.error('Error exchanging code for session:', err);
          if (active) {
            setError('Link de redefinição inválido, expirado ou já utilizado. Por favor, solicite uma nova redefinição na tela de login.');
            setSessionLoading(false);
          }
          return;
        }
      }

      // Check if session is already active (loaded from cookie/localSession)
      const { data: { session: currentSession } } = await supabase!.auth.getSession();
      if (currentSession) {
        if (active) setSessionLoading(false);
        return;
      }

      // Listen for auth state change (Supabase parses access_token from the URL hash)
      const { data: { subscription } } = supabase!.auth.onAuthStateChange(async (event, session) => {
        if (session && active) {
          if (timer) clearTimeout(timer);
          setSessionLoading(false);
          if (unsubscribeFn) unsubscribeFn();
        }
      });
      
      unsubscribeFn = () => subscription.unsubscribe();

      // Fallback timeout in case the hash token is invalid, expired, or missing
      timer = setTimeout(() => {
        if (active) {
          setError('Link de redefinição inválido, expirado ou já utilizado. Por favor, solicite uma nova redefinição na tela de login.');
          setSessionLoading(false);
          if (unsubscribeFn) unsubscribeFn();
        }
      }, 5000);
    };

    checkSession();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (unsubscribeFn) unsubscribeFn();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
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
      // Update password using Supabase Auth (recovers session allows this operation)
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
      console.error('Error updating password:', err);
      setError(err.message || 'Erro ao redefinir a senha. Tente novamente.');
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={`${styles.container} glass`}>
          <div className={styles.loaderWrapper}>
            <div className="loading-spinner"></div>
            <p className={styles.subtitle}>Verificando sessão de redefinição...</p>
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
          </div>
          <h2 className={styles.title}>Definir Nova Senha</h2>
          <p className={styles.subtitle}>
            Digite e confirme sua nova senha de acesso abaixo para reestabelecer o login na sua conta.
          </p>
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
            <span>Senha redefinida com sucesso! Acessando painel...</span>
          </div>
        )}

        {!error && !success && (
          <form onSubmit={handleResetPassword} className={styles.form}>
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
                  placeholder="Repita a nova senha"
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
              {loading ? <span className="loading-spinner"></span> : 'Salvar Nova Senha'}
            </button>
          </form>
        )}

        {error && (
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
