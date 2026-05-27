import { Subscription } from './types';

export interface Features {
  canInviteUsers: boolean;
  canUseReports: boolean;
  canUseAutomation: boolean;
  maxUsers: number;
  maxPipelines: number;
}

export const PLAN_FEATURES: Record<'basic' | 'pro' | 'enterprise', Features> = {
  basic: {
    canInviteUsers: true,
    canUseReports: false,
    canUseAutomation: false,
    maxUsers: 2,
    maxPipelines: 1,
  },
  pro: {
    canInviteUsers: true,
    canUseReports: true,
    canUseAutomation: true,
    maxUsers: 999,
    maxPipelines: 999,
  },
  enterprise: {
    canInviteUsers: true,
    canUseReports: true,
    canUseAutomation: true,
    maxUsers: 9999,
    maxPipelines: 9999,
  },
};

/**
 * Retorna os limites e recursos disponíveis para a organização com base na sua assinatura.
 * Se o trial tiver vencido ou o pagamento estiver inadimplente, bloqueia recursos premium.
 */
export function getOrgFeatures(subscription: Subscription | null): Features {
  if (!subscription) {
    // Caso não exista assinatura criada (onboarding incompleto), limita ao básico
    return PLAN_FEATURES.basic;
  }

  const now = new Date();
  
  // Verificar se o trial expirou
  const isTrialExpired = 
    subscription.status === 'trialing' && 
    subscription.trial_ends_at && 
    new Date(subscription.trial_ends_at) < now;

  // Verificar se está cancelado ou sem pagamento
  const isInactive = ['canceled', 'unpaid'].includes(subscription.status);

  if (isTrialExpired || isInactive) {
    // Conta Bloqueada / Limites reduzidos ao mínimo absoluto para forçar assinatura
    return {
      canInviteUsers: false,
      canUseReports: false,
      canUseAutomation: false,
      maxUsers: 1, // Apenas o administrador titular consegue operar
      maxPipelines: 0,
    };
  }

  return PLAN_FEATURES[subscription.plan] || PLAN_FEATURES.basic;
}

export function canAccessFeature(subscription: Subscription | null, featureKey: keyof Omit<Features, 'maxUsers' | 'maxPipelines'>): boolean {
  const features = getOrgFeatures(subscription);
  return !!features[featureKey];
}

export function getPlanLimits(planKey: 'basic' | 'pro' | 'enterprise'): Features {
  return PLAN_FEATURES[planKey] || PLAN_FEATURES.basic;
}

export function hasReachedLimit(subscription: Subscription | null, currentCount: number, featureKey: 'maxUsers' | 'maxPipelines'): boolean {
  const features = getOrgFeatures(subscription);
  const limit = features[featureKey];
  return currentCount >= limit;
}
