'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode } from '@/lib/supabase';
import { Sprout, Lock, AlertCircle, Check, Key } from 'lucide-react';
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

  useEffect(() => {
    const checkInviteSession = async () => {
      try {
        if (isMockMode) {
          setError('O modo de demonstração local está ativo. Para testar convites reais por e-mail, configure as credenciais do Supabase no .env.local.');
          setSessionLoading(false);
          return;
        }

        // Wait a small moment to let Supabase SDK process hash parameters from the URL
        await new Promise((r) => setTimeout(r, 800));

        const { data: { session } } = await supabase!.auth.getSession();

        if (!session) {
          setError('Link de convite inválido, expirado ou você já o utilizou. Por favor, solicite um novo convite ao administrador do Box.');
          setSessionLoading(false);
          return;
        }

        // Get profiles and organization details
        const { data: userProfile, error: profileErr } = await supabase!
          .from('profiles')
          .select('*, organizations(*)')
          .eq('id', session.user.id)
          .single();

        if (profileErr || !userProfile) {
          setError('Não encontramos as informações da sua conta. Fale com seu administrador.');
        } else {
          setProfile(userProfile);
        }
      } catch (err: any) {
        console.error('Error verifying invite:', err);
        setError('Ocorreu um erro ao verificar o convite.');
      } finally {
        setSessionLoading(false);
      }
    };

    checkInviteSession();
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
            <Sprout className={styles.logoIcon} size={28} />
            <span className={styles.logoText}>
              Box<span className={styles.logoHighlight}>Hub</span>
            </span>
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
                  type="password" 
                  className="form-control" 
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Mínimo 6 caracteres"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar Nova Senha</label>
              <div className="input-wrapper" style={{ position: 'relative' }}>
                <Key size={16} className="input-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-control" 
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Repita a senha"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
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
