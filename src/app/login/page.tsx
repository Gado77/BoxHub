'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isMockMode, mockDb, mockStore } from '@/lib/supabase';
import { Sprout, Lock, Mail, User, Building, AlertCircle } from 'lucide-react';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [boxName, setBoxName] = useState('');
  
  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already logged in (redirect to dashboard)
  useEffect(() => {
    const checkUser = async () => {
      if (isMockMode) {
        // If mock user set, go to dashboard
        if (typeof window !== 'undefined' && localStorage.getItem('boxhub_current_user_id')) {
          router.push('/dashboard');
        }
      } else {
        const { data } = await supabase!.auth.getSession();
        if (data.session) {
          router.push('/dashboard');
        }
      }
    };
    checkUser();
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
        router.push('/dashboard');
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
        if (!data.user) throw new Error('Falha no cadastro.');

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

        // Then profile
        const { error: profErr } = await supabase!
          .from('profiles')
          .insert({
            id: data.user.id,
            organization_id: orgId,
            name: name,
            role: 'admin'
          });
        if (profErr) throw profErr;

        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Erro no cadastro:', err);
      setError(err.message || 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} glass animate-fade-in`}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <Sprout className={styles.logoIcon} size={40} />
            <h1 className={styles.logoText}>
              Box<span className={styles.logoHighlight}>Hub</span>
            </h1>
          </div>
          <p className={styles.tagline}>Gestão que colhe resultados.</p>
        </div>

        <div className={styles.tabs}>
          <button 
            type="button"
            className={`${styles.tab} ${activeTab === 'login' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('login'); setError(null); }}
          >
            Entrar
          </button>
          <button 
            type="button"
            className={`${styles.tab} ${activeTab === 'register' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('register'); setError(null); }}
          >
            Cadastrar Box
          </button>
        </div>

        {error && (
          <div className="badge badge-danger" style={{ display: 'flex', gap: '0.5rem', width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        {activeTab === 'login' ? (
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
                  type="password" 
                  className="form-control" 
                  placeholder="••••••••"
                  style={{ paddingLeft: '40px' }}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : 'Acessar Conta'}
            </button>
          </form>
        ) : (
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
                  type="password" 
                  className="form-control" 
                  placeholder="Mínimo 6 caracteres"
                  style={{ paddingLeft: '40px' }}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className={`btn-primary ${styles.submitBtn}`} disabled={loading}>
              {loading ? <span className="loading-spinner"></span> : 'Criar Conta e Iniciar'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
