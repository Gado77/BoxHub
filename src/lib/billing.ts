import Stripe from 'stripe';
import { asaas } from './asaas';

export interface BillingProvider {
  createCustomer(orgId: string, email: string, name: string): Promise<string>;
  createSubscription(
    orgId: string,
    customerId: string,
    priceId: string,
    plan: string,
    cycle: 'monthly' | 'annual',
    trialEndsAt?: string | null
  ): Promise<{ url: string; subscriptionId: string }>;
  getBillingPortalUrl(customerId: string): Promise<string>;
}

// Configuração do Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' as any })
  : null;

export class StripeBillingProvider implements BillingProvider {
  async createCustomer(orgId: string, email: string, name: string): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe não está configurado. Defina a chave STRIPE_SECRET_KEY.');
    }
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { orgId },
    });
    return customer.id;
  }

  async createSubscription(
    orgId: string,
    customerId: string,
    priceId: string,
    plan: string,
    cycle: 'monthly' | 'annual',
    trialEndsAt?: string | null
  ): Promise<{ url: string; subscriptionId: string }> {
    if (!stripe) {
      throw new Error('Stripe não está configurado. Defina a chave STRIPE_SECRET_KEY.');
    }

    let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    appUrl = appUrl.trim();
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/dashboard/configuracoes?canceled=true`,
      customer: customerId,
      subscription_data: {
        metadata: { orgId },
      },
      metadata: { orgId },
    };

    // Adiciona trial se aplicável
    if (trialEndsAt) {
      const trialEndUnix = Math.floor(new Date(trialEndsAt).getTime() / 1000);
      if (trialEndUnix > Math.floor(Date.now() / 1000)) {
        sessionOptions.subscription_data = {
          ...sessionOptions.subscription_data,
          trial_end: trialEndUnix,
        };
      }
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);
    return {
      url: session.url || '',
      subscriptionId: '', // Stripe checkout não gera o subscription_id na hora
    };
  }

  async getBillingPortalUrl(customerId: string): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe não está configurado. Defina a chave STRIPE_SECRET_KEY.');
    }

    let appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    appUrl = appUrl.trim();
    if (!appUrl.startsWith('http://') && !appUrl.startsWith('https://')) {
      appUrl = `https://${appUrl}`;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/configuracoes`,
    });

    return portalSession.url;
  }
}

export class AsaasBillingProvider implements BillingProvider {
  async createCustomer(orgId: string, email: string, name: string): Promise<string> {
    // Tenta encontrar cliente já existente por email para evitar duplicados
    const existing = await asaas.findCustomerByEmail(email);
    if (existing) {
      return existing.id;
    }
    const customer = await asaas.createCustomer(name, email, orgId);
    return customer.id;
  }

  async createSubscription(
    orgId: string,
    customerId: string,
    priceId: string,
    plan: string,
    cycle: 'monthly' | 'annual',
    trialEndsAt?: string | null
  ): Promise<{ url: string; subscriptionId: string }> {
    // Mapeamento dos valores de faturamento do BoxHub
    let value = 297; // Default: Pro mensal
    if (plan === 'basic') {
      value = cycle === 'annual' ? 1470 : 147;
    } else {
      value = cycle === 'annual' ? 2970 : 297;
    }

    // Calcula a data de vencimento da primeira parcela
    let nextDueDateStr = '';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (trialEndsAt) {
      const trialDate = new Date(trialEndsAt);
      // Se a data de expiração do trial é futura, usamos ela
      if (trialDate.getTime() > Date.now()) {
        nextDueDateStr = trialDate.toISOString().split('T')[0];
      }
    }

    if (!nextDueDateStr) {
      nextDueDateStr = tomorrow.toISOString().split('T')[0];
    }

    // Cria a assinatura recorrente no Asaas
    const subscription = await asaas.createSubscription({
      customer: customerId,
      value,
      cycle: cycle === 'monthly' ? 'MONTHLY' : 'YEARLY',
      nextDueDate: nextDueDateStr,
      description: `Assinatura BoxHub - Plano ${plan === 'basic' ? 'Básico' : 'Pro'} (${cycle === 'annual' ? 'Anual' : 'Mensal'})`,
      externalReference: orgId,
    });

    // Obtém faturas geradas para a assinatura recém-criada para retornar a URL de pagamento
    const payments = await asaas.getSubscriptionPayments(subscription.id);
    if (payments.length === 0) {
      // Caso o Asaas demore a gerar, tenta buscar pelo ID do cliente como fallback
      const custPayments = await asaas.getCustomerPayments(customerId);
      if (custPayments.length > 0) {
        return {
          url: custPayments[0].invoiceUrl,
          subscriptionId: subscription.id,
        };
      }
      throw new Error('Nenhuma cobrança gerada para a assinatura criada no Asaas.');
    }

    return {
      url: payments[0].invoiceUrl,
      subscriptionId: subscription.id,
    };
  }

  async getBillingPortalUrl(customerId: string): Promise<string> {
    // Retorna a URL da fatura pendente ou da última fatura do cliente como portal
    const payments = await asaas.getCustomerPayments(customerId);
    
    // Tenta encontrar uma cobrança pendente (não paga) primeiro
    const pending = payments.find((p) => ['PENDING', 'OVERDUE'].includes(p.status));
    if (pending) {
      return pending.invoiceUrl;
    }

    if (payments.length > 0) {
      return payments[0].invoiceUrl;
    }

    throw new Error('Nenhuma fatura encontrada para este cliente Asaas.');
  }
}

/**
 * Retorna o provedor de faturamento ativo baseado na variável de ambiente BILLING_PROVIDER.
 */
export function getBillingProvider(): BillingProvider {
  const provider = (process.env.BILLING_PROVIDER || 'stripe').toLowerCase().trim();
  console.log(`[Billing Factory] Resolvendo provider de faturamento: ${provider}`);
  if (provider === 'asaas') {
    return new AsaasBillingProvider();
  }
  return new StripeBillingProvider();
}
