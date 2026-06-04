export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  externalReference: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  cycle: 'MONTHLY' | 'YEARLY';
  status: string;
  billingType: string;
  externalReference: string;
}

export interface AsaasPayment {
  id: string;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  status: string;
}

const ASAAS_API_URL = (process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3').trim();
const ASAAS_API_KEY = (process.env.ASAAS_API_KEY || '').trim();

async function asaasFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!ASAAS_API_KEY) {
    throw new Error('Chave de API do Asaas (ASAAS_API_KEY) não está configurada no servidor.');
  }

  const url = `${ASAAS_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    console.error(`[Asaas API] Erro ao parsear JSON da resposta. Status: ${response.status}. Texto:`, text);
    throw new Error(`Erro de comunicação com Asaas (Status ${response.status})`);
  }

  if (!response.ok) {
    const errorMsg = data.errors ? data.errors.map((e: any) => e.description).join(', ') : 'Erro desconhecido';
    console.error(`[Asaas API Error] Endpoint: ${endpoint}. Status: ${response.status}. Erros:`, errorMsg);
    throw new Error(`Asaas API Error: ${errorMsg}`);
  }

  return data as T;
}

export const asaas = {
  /**
   * Cria um cliente no Asaas
   */
  async createCustomer(name: string, email: string, externalReference: string): Promise<AsaasCustomer> {
    console.log(`[Asaas] Criando cliente: ${name} (${email})`);
    const isSandbox = ASAAS_API_URL.includes('sandbox') || ASAAS_API_KEY.includes('hmlg');
    const cpfCnpj = isSandbox ? '00000000000191' : undefined;
    
    return asaasFetch<AsaasCustomer>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        externalReference,
        cpfCnpj,
      }),
    });
  },

  /**
   * Atualiza um cliente no Asaas
   */
  async updateCustomer(id: string, params: { name?: string; email?: string; cpfCnpj?: string }): Promise<AsaasCustomer> {
    console.log(`[Asaas] Atualizando cliente: ${id}`);
    return asaasFetch<AsaasCustomer>(`/customers/${id}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  /**
   * Busca um cliente pelo email ou externalReference
   */
  async findCustomerByEmail(email: string): Promise<AsaasCustomer | null> {
    const data = await asaasFetch<{ data: AsaasCustomer[] }>(`/customers?email=${encodeURIComponent(email)}`);
    return data.data.length > 0 ? data.data[0] : null;
  },

  /**
   * Cria uma assinatura recorrente
   */
  async createSubscription(params: {
    customer: string;
    value: number;
    cycle: 'MONTHLY' | 'YEARLY';
    nextDueDate: string;
    description: string;
    externalReference: string;
  }): Promise<AsaasSubscription> {
    console.log(`[Asaas] Criando assinatura para o cliente: ${params.customer}, valor: R$ ${params.value}`);
    return asaasFetch<AsaasSubscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        customer: params.customer,
        billingType: 'UNDEFINED', // Permite que o cliente pague via PIX, Boleto ou Cartão na fatura
        value: params.value,
        cycle: params.cycle,
        nextDueDate: params.nextDueDate,
        description: params.description,
        externalReference: params.externalReference,
      }),
    });
  },

  /**
   * Obtém os pagamentos (faturas) gerados para uma assinatura
   */
  async getSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
    const data = await asaasFetch<{ data: AsaasPayment[] }>(`/subscriptions/${subscriptionId}/payments`);
    return data.data;
  },

  /**
   * Obtém os pagamentos de um cliente
   */
  async getCustomerPayments(customerId: string): Promise<AsaasPayment[]> {
    const data = await asaasFetch<{ data: AsaasPayment[] }>(`/payments?customer=${customerId}`);
    return data.data;
  },

  /**
   * Cancela uma assinatura ativa
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    console.log(`[Asaas] Cancelando assinatura: ${subscriptionId}`);
    await asaasFetch<any>(`/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
    });
  }
};
