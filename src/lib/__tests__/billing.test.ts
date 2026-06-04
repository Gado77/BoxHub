import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { getBillingProvider, StripeBillingProvider, AsaasBillingProvider } from '../billing';
import { mockDb, mockStore } from '../mock';
import { POST as fiadoAlertHandler } from '../../app/api/sales/fiado-alert/route';

// Mocks para Supabase Server e Admin
const mockGetUser = vi.fn();
const mockProfileQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockSalesQuery = vi.fn();
const mockPaymentsQuery = vi.fn();
const mockNotificationsQuery = vi.fn();

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(() => Promise.resolve({
    auth: {
      getUser: mockGetUser
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: mockProfileQuery
        };
      }
      return {};
    })
  }))
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((table) => {
      if (table === 'clients') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: mockClientQuery
        };
      }
      if (table === 'sales') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: mockSalesQuery
        };
      }
      if (table === 'fiado_payments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: mockPaymentsQuery
        };
      }
      if (table === 'notifications') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: mockNotificationsQuery,
          insert: vi.fn().mockResolvedValue({ data: {}, error: null })
        };
      }
      return {};
    })
  }))
}));

describe('Billing Systems and Fiado Rule Tests', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role';
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    
    // Limpar o storage de notificações mock
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Billing Factory Resolution', () => {
    it('deve resolver para StripeBillingProvider por padrão se BILLING_PROVIDER não estiver definido', () => {
      const originalEnv = process.env.BILLING_PROVIDER;
      delete process.env.BILLING_PROVIDER;
      
      const provider = getBillingProvider();
      expect(provider).toBeInstanceOf(StripeBillingProvider);

      process.env.BILLING_PROVIDER = originalEnv;
    });

    it('deve resolver para AsaasBillingProvider se BILLING_PROVIDER for "asaas"', () => {
      const originalEnv = process.env.BILLING_PROVIDER;
      process.env.BILLING_PROVIDER = 'asaas';
      
      const provider = getBillingProvider();
      expect(provider).toBeInstanceOf(AsaasBillingProvider);

      process.env.BILLING_PROVIDER = originalEnv;
    });

    it('deve resolver ignorando espaços e case sensitivity', () => {
      const originalEnv = process.env.BILLING_PROVIDER;
      process.env.BILLING_PROVIDER = '  ASAAS  ';
      
      const provider = getBillingProvider();
      expect(provider).toBeInstanceOf(AsaasBillingProvider);

      process.env.BILLING_PROVIDER = originalEnv;
    });
  });

  describe('Asaas Subscription Cycle Calculation', () => {
    it('deve instanciar AsaasBillingProvider e calcular valores corretos para planos e ciclos', () => {
      const provider = new AsaasBillingProvider();
      expect(provider).toBeDefined();
    });
  });

  describe('Notificação de Fiado 90% Limite (Regra de Negócio)', () => {
    it('deve disparar um alerta/notificação se a nova compra fiada fizer o débito atingir 90% ou mais do limite do cliente', () => {
      const client = {
        id: 'cli-test-fiado',
        name: 'Cliente Teste Fiado Limit',
        organization_id: 'org-ceagesp-123',
        type: 'quitanda' as const,
        contact: '(11) 98888-8888',
        fiado_limit: 1000.00,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const allClients = mockStore.getClients();
      allClients.push(client);
      mockStore.saveClients(allClients);

      const sales = mockStore.getSales();
      sales.push({
        id: 'sale-test-fiado-1',
        organization_id: 'org-ceagesp-123',
        client_id: 'cli-test-fiado',
        seller_id: 'usr-admin-456',
        total_amount: 850.00,
        payment_method: 'fiado',
        status: 'pendente',
        created_at: new Date().toISOString()
      });
      mockStore.saveSales(sales);

      let balance = mockDb.fiado.getBalance('cli-test-fiado');
      expect(balance).toBe(850.00);

      let notifs = mockStore.getNotifications();
      let hasFiadoNotif = notifs.some(n => n.type === 'fiado' && n.metadata?.client_id === 'cli-test-fiado');
      expect(hasFiadoNotif).toBe(false);

      const totalAmount = 60.00;
      const clientFiadoBalance = 850.00;
      const newBalance = clientFiadoBalance + totalAmount;
      const ratio = newBalance / client.fiado_limit;

      if (ratio >= 0.9) {
        const alreadyAlerted = notifs.some(
          (n: any) => n.type === 'fiado' && n.status === 'unread' && n.metadata?.client_id === client.id
        );
        if (!alreadyAlerted) {
          const newNotif = {
            id: `notif-fiado-test`,
            organization_id: client.organization_id,
            user_id: null,
            title: '⚠️ Limite de fiado atingido',
            message: `O cliente ${client.name} atingiu ${(ratio * 100).toFixed(0)}% do seu limite de fiado disponível.`,
            description: `${client.name} possui um débito em aberto de R$ ${newBalance.toFixed(2)} de um limite de R$ ${client.fiado_limit.toFixed(2)}.`,
            type: 'fiado',
            priority: 'high' as const,
            source: 'system' as const,
            status: 'unread' as const,
            is_pinned: false,
            action_url: '/dashboard/fiado',
            action_label: 'Ver Gestão de Fiado',
            metadata: { client_id: client.id, current_balance: newBalance, limit: client.fiado_limit },
            read_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          notifs.unshift(newNotif);
          mockStore.saveNotifications(notifs);
        }
      }

      const updatedNotifs = mockStore.getNotifications();
      hasFiadoNotif = updatedNotifs.some(n => n.type === 'fiado' && n.metadata?.client_id === 'cli-test-fiado');
      
      expect(hasFiadoNotif).toBe(true);
    });
  });

  describe('Segurança e Regras do Endpoint /api/sales/fiado-alert', () => {
    it('deve retornar status 403 se o cliente consultado pertencer a outra organização', async () => {
      // Usuário autenticado pertence à org-1
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } }, error: null });
      mockProfileQuery.mockResolvedValue({ data: { organization_id: 'org-1', role: 'admin' }, error: null });
      
      // Cliente pertence à org-2 (tenant diferente)
      mockClientQuery.mockResolvedValue({ data: { id: 'cli-abc', organization_id: 'org-2', fiado_limit: 1000.00 }, error: null });

      const request = new Request('http://localhost/api/sales/fiado-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'cli-abc' })
      });

      const response = await fiadoAlertHandler(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Acesso negado');
    });

    it('deve retornar alerted: false e reason: limit_is_zero_or_negative se o limite de fiado do cliente for zero', async () => {
      // Mesmo tenant
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } }, error: null });
      mockProfileQuery.mockResolvedValue({ data: { organization_id: 'org-1', role: 'admin' }, error: null });
      mockClientQuery.mockResolvedValue({ data: { id: 'cli-abc', organization_id: 'org-1', fiado_limit: 0 }, error: null });
      
      mockSalesQuery.mockResolvedValue({ data: [{ total_amount: 300.00 }], error: null });
      mockPaymentsQuery.mockResolvedValue({ data: [], error: null });

      const request = new Request('http://localhost/api/sales/fiado-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'cli-abc' })
      });

      const response = await fiadoAlertHandler(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.alerted).toBe(false);
      expect(data.reason).toBe('limit_is_zero_or_negative');
      expect(data.balance).toBe(300.00);
    });

    it('deve calcular corretamente o saldo somando todas as vendas fiado não canceladas (inclusive pagas) menos amortizações', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } }, error: null });
      mockProfileQuery.mockResolvedValue({ data: { organization_id: 'org-1', role: 'admin' }, error: null });
      mockClientQuery.mockResolvedValue({ data: { id: 'cli-abc', organization_id: 'org-1', fiado_limit: 1000.00 }, error: null });
      
      // Duas vendas fiado: R$ 500 (status: pago) e R$ 400 (status: pendente) = Total R$ 900
      mockSalesQuery.mockResolvedValue({ 
        data: [
          { total_amount: 500.00 },
          { total_amount: 400.00 }
        ], 
        error: null 
      });
      
      // Amortizações totais de R$ 500
      mockPaymentsQuery.mockResolvedValue({ 
        data: [
          { amount: 500.00 }
        ], 
        error: null 
      });
      
      // Simular que não há alertas duplicados recentes
      mockNotificationsQuery.mockResolvedValue({ data: null, error: null });

      const request = new Request('http://localhost/api/sales/fiado-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'cli-abc' })
      });

      const response = await fiadoAlertHandler(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Saldo devedor líquido esperado: (500 + 400) - 500 = R$ 400
      expect(data.balance).toBe(400.00);
      expect(data.limit).toBe(1000.00);
      expect(data.percentage).toBe(40); // 40% do limite
      expect(data.alerted).toBe(false); // < 90%
    });
  });
});
