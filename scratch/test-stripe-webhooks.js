const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

// Parse .env.local file from workspace root
const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local não encontrado! Execute na raiz do projeto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const stripeSecretKey = env.STRIPE_SECRET_KEY;
const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
const pricePro = env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_pro_mock';
const priceBasic = env.NEXT_PUBLIC_STRIPE_PRICE_BASIC || 'price_basic_mock';

if (!stripeSecretKey || !webhookSecret) {
  console.error('❌ STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausentes no .env.local!');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' });

// Porta padrão do servidor dev local
const LOCAL_PORT = 3000;
const WEBHOOK_URL = `http://localhost:${LOCAL_PORT}/api/stripe/webhook`;

// ID da organização de simulação ou de teste
const TEST_ORG_ID = 'org-ceagesp-123'; // Matches default mock org or can be overridden

async function sendMockWebhook(eventPayload) {
  const payloadStr = JSON.stringify(eventPayload);
  
  // Gerar a assinatura oficial usando a biblioteca Stripe SDK
  const signature = stripe.webhooks.generateSignatureHeader({
    payload: payloadStr,
    secret: webhookSecret
  });

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature
      },
      body: payloadStr
    });

    const text = await response.text();
    console.log(`📤 Enviado [${eventPayload.type}]: status HTTP ${response.status}. Retorno:`, text);
    return response.status === 200;
  } catch (err) {
    console.error(`❌ Erro ao enviar webhook para ${WEBHOOK_URL}:`, err.message);
    return false;
  }
}

function generateStripeEvent(type, objectData) {
  return {
    id: `evt_test_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    type: type,
    data: {
      object: objectData
    }
  };
}

async function runWebhookTests() {
  console.log('🧪 Iniciando testes de integridade de webhooks do Stripe...');
  console.log(`⚠️ ATENÇÃO: Certifique-se de que o servidor local está rodando em http://localhost:${LOCAL_PORT} antes de continuar.\n`);

  const customerId = `cus_test_${Math.random().toString(36).substring(7)}`;
  const subscriptionId = `sub_test_${Math.random().toString(36).substring(7)}`;

  // 1. Checkout Session Completa (Assinatura Inicial)
  console.log('📝 Cenário 1: Finalização de Checkout do Stripe (Compra Plano Pro)...');
  const checkoutSessionObj = {
    id: `cs_test_${Math.random().toString(36).substring(7)}`,
    object: 'checkout.session',
    customer: customerId,
    mode: 'subscription',
    subscription: subscriptionId,
    metadata: {
      orgId: TEST_ORG_ID
    }
  };
  const event1 = generateStripeEvent('checkout.session.completed', checkoutSessionObj);
  await sendMockWebhook(event1);

  // 2. Subscription Update: Upgrade de Plano (Muda priceId para Pro)
  console.log('\n📝 Cenário 2: Atualização de Assinatura (Upgrade para Pro)...');
  const subscriptionObj = {
    id: subscriptionId,
    object: 'subscription',
    customer: customerId,
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      object: 'list',
      data: [{
        price: {
          id: pricePro,
          recurring: { interval: 'month' }
        }
      }]
    },
    metadata: {
      orgId: TEST_ORG_ID
    }
  };
  const event2 = generateStripeEvent('customer.subscription.updated', subscriptionObj);
  await sendMockWebhook(event2);

  // 3. Subscription Update: Downgrade de Plano (Muda priceId para Basic)
  console.log('\n📝 Cenário 3: Atualização de Assinatura (Downgrade para Básico)...');
  subscriptionObj.items.data[0].price.id = priceBasic;
  const event3 = generateStripeEvent('customer.subscription.updated', subscriptionObj);
  await sendMockWebhook(event3);

  // 4. Subscription Update: Mudança para Anual (billing_cycle)
  console.log('\n📝 Cenário 4: Alteração de Ciclo de Cobrança (Básico Mensal -> Anual)...');
  subscriptionObj.items.data[0].price.recurring.interval = 'year';
  const event4 = generateStripeEvent('customer.subscription.updated', subscriptionObj);
  await sendMockWebhook(event4);

  // 5. Payment Failed (Fatura Recusada)
  console.log('\n📝 Cenário 5: Pagamento de Fatura Recusado (Cartão Expirado)...');
  const invoiceObj = {
    id: `in_test_${Math.random().toString(36).substring(7)}`,
    object: 'invoice',
    customer: customerId,
    subscription: subscriptionId,
    billing_reason: 'subscription_cycle',
    status: 'open',
    metadata: {}
  };
  // Nota: o webhook webhook/route.ts lida com isso sincronizando a assinatura com status do Stripe (past_due)
  const event5 = generateStripeEvent('invoice.payment_failed', invoiceObj);
  await sendMockWebhook(event5);

  // 6. Subscription Deleted (Cancelamento do Plano)
  console.log('\n📝 Cenário 6: Assinatura Cancelada pelo Cliente...');
  subscriptionObj.status = 'canceled';
  const event6 = generateStripeEvent('customer.subscription.deleted', subscriptionObj);
  await sendMockWebhook(event6);

  // 7. Teste de Redundância: Enviar webhook duplicado
  console.log('\n📝 Cenário 7: Enviar webhook duplicado (Garante Idempotência)...');
  await sendMockWebhook(event6);

  // 8. Teste de Ordem de Evento: Enviar evento de atualização antigo após cancelamento
  console.log('\n📝 Cenário 8: Enviar evento antigo desatualizado após cancelamento...');
  // Deve ser ignorado pelo webhook para evitar que uma assinatura cancelada retorne para ativa indevidamente
  subscriptionObj.status = 'active';
  const eventOld = generateStripeEvent('customer.subscription.updated', subscriptionObj);
  await sendMockWebhook(eventOld);

  console.log('\n🎉 Testes de webhooks Stripe finalizados.');
}

runWebhookTests();
