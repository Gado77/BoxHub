'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isMockMode, mockDb } from '@/lib/supabase';
import { Subscription, Organization } from '@/lib/types';
import { 
  Check, 
  X, 
  Crown, 
  AlertTriangle, 
  MessageSquare, 
  CreditCard, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2,
  Lock,
  Building
} from 'lucide-react';
import styles from './planos.module.css';

const WHATSAPP_NUMBER = '5511982223293'; // Número de suporte/vendas BoxHub

export default function PlanosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // Carregar dados de assinatura
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isMockMode) {
        const currentOrg = mockDb.getOrg();
        const currentSub = mockDb.subscriptions.get();
        setOrg(currentOrg);
        setSubscription(currentSub);
      } else {
        const { data: { session } } = await supabase!.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Buscar perfil e organização
        const { data: profile } = await supabase!
          .from('profiles')
          .select('organization_id')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const { data: orgData } = await supabase!
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single();

          const { data: subData } = await supabase!
            .from('subscriptions')
            .select('*')
            .eq('company_id', profile.organization_id)
            .single();

          setOrg(orgData);
          setSubscription(subData);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados faturamento:', err);
      setError('Não foi possível carregar as informações do seu plano.');
    } finally {
      setLoading(false);
    }
  };

  // Helper de Analytics (Mixpanel, GA4, PostHog, etc.)
  const logAnalytics = (eventName: string, metadata: any = {}) => {
    console.log(`[Analytics] Evento disparado: ${eventName}`, metadata);
    // Em produção real: window.mixpanel.track(eventName, metadata)
  };

  useEffect(() => {
    loadData();
    logAnalytics('viewed_pricing_page', { billing_period: billingPeriod });
  }, []);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      logAnalytics('completed_checkout');
      setSuccess('Sua assinatura foi processada e ativada com sucesso!');
    }
  }, [searchParams]);

  const handleToggleBillingPeriod = (period: 'monthly' | 'annual') => {
    setBillingPeriod(period);
    logAnalytics('viewed_pricing_page', { billing_period: period, current_plan: subscription?.plan });
  };

  // Lógica para obter a quantidade de dias restantes de trial
  const getTrialDaysRemaining = () => {
    if (subscription && subscription.trial_ends_at) {
      const ends = new Date(subscription.trial_ends_at).getTime();
      const now = new Date().getTime();
      const diffTime = ends - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    
    // Fallback: calcula o trial de 7 dias com base na criação da organização
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

  // Obter idade da assinatura em dias
  const getSubAgeInDays = () => {
    if (subscription && subscription.created_at) {
      const created = new Date(subscription.created_at).getTime();
      const now = new Date().getTime();
      const diffTime = Math.abs(now - created);
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 999;
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading('portal');
      setError(null);
      logAnalytics('clicked_manage_billing', { customer_id: subscription?.stripe_customer_id });

      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 600));
        // Alternar trial/active no mock localmente
        const isCurrentActive = subscription?.status === 'active';
        mockDb.subscriptions.update({
          status: isCurrentActive ? 'trialing' : 'active',
        });
        setSuccess('Estado da assinatura mock alternado localmente!');
        await loadData();
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
      setError(err.message || 'Erro ao carregar configurações de pagamento.');
    } finally {
      setActionLoading(null);
    }
  };

  // Tratar ação de selecionar plano
  const handleSelectPlan = async (planKey: 'basic' | 'pro' | 'enterprise') => {
    logAnalytics('clicked_upgrade', { plan: planKey, billing_period: billingPeriod });

    if (planKey === 'enterprise') {
      const text = encodeURIComponent('Olá! Tenho interesse no Plano Enterprise do BoxHub para o meu Box.');
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank');
      return;
    }

    const priceId = planKey === 'pro' 
      ? (billingPeriod === 'annual' ? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL : process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) 
      : (billingPeriod === 'annual' ? process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_ANNUAL : process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC);

    if (!priceId && !isMockMode) {
      setError('Configuração do Stripe ausente para este plano.');
      return;
    }

    logAnalytics('started_checkout', { plan: planKey, billing_period: billingPeriod, price_id: priceId });

    try {
      setActionLoading(planKey);
      setError(null);

      if (isMockMode) {
        // Simular atualização no banco local
        await new Promise((r) => setTimeout(r, 800));
        const periodDays = billingPeriod === 'annual' ? 365 : 30;
        mockDb.subscriptions.update({
          plan: planKey,
          status: 'active',
          stripe_price_id: priceId || `price_mock_${planKey}_${billingPeriod}`,
          trial_ends_at: null,
          current_period_end: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString(),
          billing_cycle: billingPeriod
        });
        logAnalytics('upgraded_plan', { plan: planKey, billing_period: billingPeriod });
        setSuccess(`Plano ${planKey === 'pro' ? 'Pro' : 'Básico'} (${billingPeriod === 'annual' ? 'Anual' : 'Mensal'}) ativado no ambiente sandbox!`);
        await loadData();
      } else {
        // Fazer checkout real no Stripe
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erro ao gerar sessão de checkout.');
        }

        if (data.url) {
          window.location.href = data.url;
        } else if (data.updated) {
          logAnalytics('upgraded_plan', { plan: planKey, billing_period: billingPeriod });
          setSuccess(`Plano alterado com sucesso! Sincronizando...`);
          // Espera 2.5 segundos para dar tempo ao webhook de atualizar o banco de dados
          await new Promise((r) => setTimeout(r, 2500));
          await loadData();
        } else {
          throw new Error('Nenhuma URL de redirecionamento retornada.');
        }
      }
    } catch (err: any) {
      console.error('Erro na contratação do plano:', err);
      setError(err.message || 'Erro ao redirecionar para a página de faturamento.');
    } finally {
      setActionLoading(null);
    }
  };

  // Retorna se o plano exibido é o plano atual do cliente
  const isCurrentPlan = (planKey: 'basic' | 'pro' | 'enterprise') => {
    if (!subscription) {
      // Se não há assinatura cadastrada mas o trial calculado é ativo, considera o Plano Pro atual
      if (planKey === 'pro') {
        return getTrialDaysRemaining() > 0;
      }
      return false;
    }
    return subscription.plan === planKey && ['active', 'trialing'].includes(subscription.status);
  };

  // Retorna texto descritivo do status do plano
  const getSubscriptionStatusText = () => {
    if (!subscription) {
      const days = getTrialDaysRemaining();
      return days > 0 ? 'Período de Testes (Trial)' : 'Faturamento Pendente';
    }
    const mapping: Record<string, string> = {
      trialing: 'Período de Testes (Trial)',
      active: 'Assinatura Ativa',
      past_due: 'Pagamento Pendente / Atrasado',
      canceled: 'Assinatura Cancelada',
      unpaid: 'Assinatura Inadimplente / Bloqueada',
      incomplete: 'Pagamento Incompleto'
    };
    return mapping[subscription.status] || subscription.status;
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.skeleton} style={{ height: '40px', width: '250px', margin: '0 auto 10px' }}></div>
          <div className={styles.skeleton} style={{ height: '20px', width: '400px', margin: '0 auto' }}></div>
        </div>
        <div className={styles.grid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.card} ${styles.skeleton}`} style={{ height: '420px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const trialDaysLeft = getTrialDaysRemaining();
  // Se não há assinatura cadastrada, calcula a expiração do trial baseado no tempo de criação da organização
  const isTrialExpired = subscription 
    ? (subscription.status === 'trialing' && trialDaysLeft <= 0) 
    : (trialDaysLeft <= 0);
  const isUnpaid = ['past_due', 'unpaid', 'canceled'].includes(subscription?.status || '');

  return (
    <div className={styles.wrapper}>
      {/* 1. Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Planos e Faturamento</h1>
        <p className={styles.subtitle}>Escolha o plano ideal para gerenciar suas vendas e estoque na CEAGESP.</p>
      </div>

      {/* 2. Alerts Contextuais de Faturamento */}
      <div className={styles.alertContainer}>
        {isTrialExpired && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <AlertTriangle size={20} className={styles.featureCheck} style={{ color: '#ef4444' }} />
            <div>
              <strong>Seu período de testes gratuito expirou!</strong> Assine um plano abaixo para liberar o acesso ao painel, vendas e faturamento de clientes.
            </div>
          </div>
        )}

        {!isTrialExpired && (subscription ? subscription.status === 'trialing' : true) && trialDaysLeft > 0 && (
          <div className={`${styles.alert} ${styles.alertWarning}`}>
            <CheckCircle2 size={20} className={styles.featureCheck} style={{ color: '#f59e0b' }} />
            <div>
              Você está no <strong>período de testes gratuito (Trial)</strong> do Plano Pro. Restam <strong>{trialDaysLeft} dias</strong>. Escolha seu plano definitivo abaixo.
            </div>
          </div>
        )}

        {isUnpaid && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <AlertTriangle size={20} className={styles.featureCheck} style={{ color: '#ef4444' }} />
            <div>
              <strong>Atenção:</strong> Sua assinatura consta como <strong>{getSubscriptionStatusText()}</strong>. Regularize seus dados de cobrança no Stripe Portal abaixo para evitar suspensão de recursos.
            </div>
          </div>
        )}

        {reason === 'requires_pro' && (
          <div className={`${styles.alert} ${styles.alertWarning}`}>
            <Lock size={20} className={styles.featureCheck} style={{ color: '#f59e0b' }} />
            <div>
              A página de <strong>Relatórios Consolidados</strong> exige recursos avançados. Faça o upgrade para o <strong>Plano Pro</strong> para acessar dados analíticos.
            </div>
          </div>
        )}

        {error && (
          <div className={`${styles.alert} ${styles.alertDanger}`}>
            <X size={20} style={{ color: '#ef4444' }} />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className={`${styles.alert} ${styles.alertWarning}`} style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)', color: 'var(--success)' }}>
            <Check size={20} style={{ color: 'var(--success)' }} />
            <div>{success}</div>
          </div>
        )}
      </div>

      {/* Se já possuir assinatura e não estiver vencido, exibe box para gerenciar faturamento */}
      {subscription && subscription.stripe_customer_id && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '2.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Plano Atual</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                {subscription.plan === 'basic' ? 'Plano Básico' : subscription.plan === 'pro' ? 'Plano Pro' : 'Plano Enterprise'}
              </strong>
              <span className={`badge ${subscription.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                {getSubscriptionStatusText()}
              </span>
            </div>
            {subscription.current_period_end && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Renovação/Vencimento em: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          <button 
            onClick={handleManageBilling}
            disabled={actionLoading !== null}
            className="btn-primary"
            style={{ minWidth: '180px', justifyContent: 'center' }}
          >
            {actionLoading === 'portal' ? (
              <span className="loading-spinner"></span>
            ) : (
              <>
                <CreditCard size={16} />
                <span>Gerenciar Faturamento</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Switch de faturamento Mensal / Anual */}
      <div className={styles.billingToggle}>
        <span 
          className={`${styles.toggleLabel} ${billingPeriod === 'monthly' ? styles.toggleLabelActive : ''}`}
          onClick={() => handleToggleBillingPeriod('monthly')}
        >
          Mensal
        </span>
        <label className={styles.switch}>
          <input 
            type="checkbox" 
            checked={billingPeriod === 'annual'}
            onChange={(e) => handleToggleBillingPeriod(e.target.checked ? 'annual' : 'monthly')}
          />
          <span className={styles.slider}></span>
        </label>
        <span 
          className={`${styles.toggleLabel} ${billingPeriod === 'annual' ? styles.toggleLabelActive : ''}`}
          onClick={() => handleToggleBillingPeriod('annual')}
        >
          Anual <span className={styles.discountBadge}>Economize 2 meses</span>
        </span>
      </div>

      {/* 4. Pricing Grid */}
      <div className={styles.grid}>
        
        {/* CARD 1: Básico */}
        <div className={`${styles.card} ${isCurrentPlan('basic') ? styles.popularCard : ''}`}>
          {isCurrentPlan('basic') && (
            <div className={styles.popularBadge}>Plano Atual</div>
          )}
          <div className={styles.planHeader}>
            <h3 className={styles.planName}>Básico</h3>
            <p className={styles.planDesc}>Ideal para boxes pequenos e gestão rápida no balcão da CEAGESP.</p>
          </div>
          <div className={styles.priceContainer}>
            <span className={styles.priceSymbol}>R$</span>
            <span className={styles.priceValue}>{billingPeriod === 'monthly' ? '147' : '122,50'}</span>
            <span className={styles.pricePeriod}>/mês</span>
          </div>
          {billingPeriod === 'annual' && (
            <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginTop: '-1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>
                Antes: R$ 1.764/ano
              </span>
              <span>Cobrado anualmente (R$ 1.470/ano)</span>
            </div>
          )}

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Até 2 usuários</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>1 pipeline de venda</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>CRM básico & Kanban</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Agenda de Contatos</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Suporte via WhatsApp</span>
            </li>
          </ul>

          <button
            onClick={() => handleSelectPlan('basic')}
            disabled={actionLoading !== null || isCurrentPlan('basic')}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {actionLoading === 'basic' ? (
              <span className="loading-spinner"></span>
            ) : isCurrentPlan('basic') ? (
              'Plano Atual'
            ) : (
              'Escolher Básico'
            )}
          </button>

          {subscription && subscription.plan === 'pro' && subscription.status === 'active' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center', lineHeight: '1.2' }}>
              {getSubAgeInDays() <= 7 ? (
                <span style={{ color: 'var(--success)' }}>
                  ✓ Reembolso Garantido: Você receberá o reembolso integral do Plano Pro ao migrar para o Básico.
                </span>
              ) : (
                <span>
                  ℹ Downgrade Pró-Rata: A diferença proporcional gerará créditos para suas próximas faturas.
                </span>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: Pro */}
        <div className={`${styles.card} ${styles.popularCard} ${isCurrentPlan('pro') ? '' : ''}`}>
          <div className={styles.popularBadge} style={{ background: 'var(--primary)' }}>Recomendado</div>
          
          <div className={styles.planHeader}>
            <h3 className={styles.planName} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Pro</span>
              <Crown size={16} style={{ color: 'var(--warning)' }} />
            </h3>
            <p className={styles.planDesc}>Ideal para empresas consolidadas, com vários vendedores e múltiplos fluxos.</p>
          </div>
          <div className={styles.priceContainer}>
            <span className={styles.priceSymbol}>R$</span>
            <span className={styles.priceValue}>{billingPeriod === 'monthly' ? '297' : '247,50'}</span>
            <span className={styles.pricePeriod}>/mês</span>
          </div>
          {billingPeriod === 'annual' && (
            <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginTop: '-1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>
                Antes: R$ 3.564/ano
              </span>
              <span>Cobrado anualmente (R$ 2.970/ano)</span>
            </div>
          )}

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <strong>Usuários Ilimitados</strong>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <strong>Pipelines Ilimitados</strong>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Relatórios Avançados & Insights</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Controle de Permissões da Equipe</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Futuras Automações de Cobrança</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Suporte Prioritário 24h</span>
            </li>
          </ul>

          <button
            onClick={() => handleSelectPlan('pro')}
            disabled={actionLoading !== null || (isCurrentPlan('pro') && subscription?.status === 'active')}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {actionLoading === 'pro' ? (
              <span className="loading-spinner"></span>
            ) : subscription?.plan === 'pro' && subscription?.status === 'trialing' ? (
              'Iniciar Assinatura Pro'
            ) : subscription?.plan === 'pro' && subscription?.status === 'active' ? (
              'Plano Atual'
            ) : !subscription && getTrialDaysRemaining() > 0 ? (
              'Iniciar Assinatura Pro'
            ) : (
              'Experimentar 7 dias grátis'
            )}
          </button>

          {subscription && subscription.plan === 'basic' && subscription.status === 'active' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center', lineHeight: '1.2' }}>
              {getSubAgeInDays() <= 7 ? (
                <span style={{ color: 'var(--success)' }}>
                  ✓ Reembolso Garantido: Você receberá o reembolso integral do Plano Básico ao migrar para o Pro.
                </span>
              ) : (
                <span>
                  ℹ Upgrade Pró-Rata: Você pagará apenas a diferença proporcional ao migrar para o Pro.
                </span>
              )}
            </div>
          )}
        </div>

        {/* CARD 3: Enterprise */}
        <div className={`${styles.card} ${isCurrentPlan('enterprise') ? styles.popularCard : ''}`}>
          {isCurrentPlan('enterprise') && (
            <div className={styles.popularBadge}>Plano Atual</div>
          )}
          <div className={styles.planHeader}>
            <h3 className={styles.planName}>Enterprise</h3>
            <p className={styles.planDesc}>Para grandes distribuidores e importadores com necessidades específicas.</p>
          </div>
          <div className={styles.priceContainer}>
            <span className={styles.priceValue} style={{ fontSize: '2rem' }}>Personalizado</span>
          </div>

          <ul className={styles.featureList}>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Tudo do Plano Pro</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Integrações Customizadas de Sistemas</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Faturamento Sob Demanda</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Gerente de Conta Dedicado</span>
            </li>
            <li className={styles.featureItem}>
              <Check className={styles.featureCheck} size={18} />
              <span>Garantia de Uptime (SLA) em Contrato</span>
            </li>
          </ul>

          <button
            onClick={() => handleSelectPlan('enterprise')}
            disabled={actionLoading !== null || isCurrentPlan('enterprise')}
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isCurrentPlan('enterprise') ? 'Plano Atual' : 'Contatar WhatsApp'}
          </button>
        </div>

      </div>

      {/* 5. Comparativo Detalhado */}
      <div className={styles.comparisonSection}>
        <h2 className={styles.comparisonTitle}>Tabela Comparativa de Recursos</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Básico</th>
                <th>Pro</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.rowFeatureName}>
                  Usuários na Equipe
                  <span className={styles.rowFeatureDesc}>Quantidade de vendedores associados ao box.</span>
                </td>
                <td>Até 2 usuários</td>
                <td><strong>Ilimitados</strong></td>
                <td><strong>Ilimitados</strong></td>
              </tr>
              <tr>
                <td className={styles.rowFeatureName}>
                  Pipelines de Venda
                  <span className={styles.rowFeatureDesc}>Diferentes funis de controle de vendas.</span>
                </td>
                <td>1 funil</td>
                <td><strong>Ilimitados</strong></td>
                <td><strong>Ilimitados</strong></td>
              </tr>
              <tr>
                <td className={styles.rowFeatureName}>
                  Relatórios e Gráficos
                  <span className={styles.rowFeatureDesc}>Análise de vendas, faturamento por quitanda e saldo fiado.</span>
                </td>
                <td><X className={styles.crossIcon} size={16} /></td>
                <td><Check className={styles.checkIcon} size={16} /></td>
                <td><Check className={styles.checkIcon} size={16} /></td>
              </tr>
              <tr>
                <td className={styles.rowFeatureName}>
                  Controle de Permissões
                  <span className={styles.rowFeatureDesc}>Defina quem pode excluir vendas, alterar fiados ou ver custos.</span>
                </td>
                <td><X className={styles.crossIcon} size={16} /></td>
                <td><Check className={styles.checkIcon} size={16} /></td>
                <td><Check className={styles.checkIcon} size={16} /></td>
              </tr>
              <tr>
                <td className={styles.rowFeatureName}>
                  Integrações de API
                  <span className={styles.rowFeatureDesc}>Conectar ao ERP próprio ou a sistemas contábeis da CEAGESP.</span>
                </td>
                <td><X className={styles.crossIcon} size={16} /></td>
                <td><X className={styles.crossIcon} size={16} /></td>
                <td><Check className={styles.checkIcon} size={16} /></td>
              </tr>
              <tr>
                <td className={styles.rowFeatureName}>
                  Suporte Operacional
                  <span className={styles.rowFeatureDesc}>Canais de ajuda para dúvidas ou emergências de faturamento.</span>
                </td>
                <td>Comercial (horário comercial)</td>
                <td>Prioritário 24/7</td>
                <td>Gerente de conta exclusivo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
