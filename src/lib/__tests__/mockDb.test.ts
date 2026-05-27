import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb, mockStore } from '../mock';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('mockDb Business Logic Tests', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
      localStorage.removeItem('boxhub_current_user_id');
    }
  });

  describe('Estoque e Inventário', () => {
    it('deve deduzir a quantidade de estoque do produto e variante ao criar uma venda se estoque_ativo for verdadeiro', () => {
      // Habilitar controle de estoque ativo
      mockDb.updateOrgSettings(true);

      const parentProductBefore = mockDb.products.get('prod-1');
      const variantBefore = mockStore.getVariants().find(v => v.id === 'var-1');

      expect(parentProductBefore).toBeDefined();
      expect(variantBefore).toBeDefined();

      const initialParentStock = parentProductBefore!.stock_quantity; // 120
      const initialVariantStock = variantBefore!.stock_quantity; // 50

      // Registrar uma nova venda de 5 caixas
      mockDb.sales.insert('cli-1', 'pix', [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 5,
          pricePerBox: 80.00
        }
      ]);

      const parentProductAfter = mockDb.products.get('prod-1');
      const variantAfter = mockStore.getVariants().find(v => v.id === 'var-1');

      // Estoque deve ter diminuído
      expect(variantAfter!.stock_quantity).toBe(initialVariantStock - 5);
      expect(parentProductAfter!.stock_quantity).toBe(initialParentStock - 5);
    });

    it('NÃO deve alterar a quantidade de estoque do produto ou variante se estoque_ativo for falso', () => {
      // Desabilitar controle de estoque
      mockDb.updateOrgSettings(false);

      const parentProductBefore = mockDb.products.get('prod-1');
      const variantBefore = mockStore.getVariants().find(v => v.id === 'var-1');

      const initialParentStock = parentProductBefore!.stock_quantity;
      const initialVariantStock = variantBefore!.stock_quantity;

      // Registrar venda
      mockDb.sales.insert('cli-1', 'pix', [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 5,
          pricePerBox: 80.00
        }
      ]);

      const parentProductAfter = mockDb.products.get('prod-1');
      const variantAfter = mockStore.getVariants().find(v => v.id === 'var-1');

      // Estoque deve continuar igual
      expect(variantAfter!.stock_quantity).toBe(initialVariantStock);
      expect(parentProductAfter!.stock_quantity).toBe(initialParentStock);
    });

    it('deve estornar a quantidade vendida de volta ao estoque da variante e produto pai ao cancelar a venda', () => {
      mockDb.updateOrgSettings(true);

      const variantBefore = mockStore.getVariants().find(v => v.id === 'var-2');
      const initialVariantStock = variantBefore!.stock_quantity; // 70
      const parentProductBefore = mockDb.products.get('prod-1');
      const initialParentStock = parentProductBefore!.stock_quantity; // 120

      // Registrar venda de 10 unidades
      const sale = mockDb.sales.insert('cli-1', 'dinheiro', [
        {
          productId: 'prod-1',
          variantId: 'var-2',
          quantity: 10,
          pricePerBox: 75.00
        }
      ]);

      // Verificar que reduziu
      let variantTemp = mockStore.getVariants().find(v => v.id === 'var-2');
      let parentTemp = mockDb.products.get('prod-1');
      expect(variantTemp!.stock_quantity).toBe(initialVariantStock - 10);
      expect(parentTemp!.stock_quantity).toBe(initialParentStock - 10);

      // Cancelar a venda
      mockDb.sales.cancel(sale.id);

      const variantAfter = mockStore.getVariants().find(v => v.id === 'var-2');
      const parentAfter = mockDb.products.get('prod-1');

      // Estoque deve retornar ao estado original
      expect(variantAfter!.stock_quantity).toBe(initialVariantStock);
      expect(parentAfter!.stock_quantity).toBe(initialParentStock);
    });
  });

  describe('Fiado e Amortizações', () => {
    it('deve calcular o saldo devedor do cliente somando vendas pendentes e subtraindo pagamentos', async () => {
      const clientId = 'cli-1';
      
      // Saldo devedor inicial do cli-1 com base nos dados iniciais de seed do mock.ts
      // No mock.ts: cli-1 tem apenas sale-1 que é meio de pagamento 'pix' e status 'pago', ou seja, saldo devedor inicial = 0
      const initialBalance = mockDb.fiado.getBalance(clientId);
      expect(initialBalance).toBe(0);

      // Inserir venda no fiado de R$ 300,00
      mockDb.sales.insert(clientId, 'fiado', [
        {
          productId: 'prod-1',
          variantId: 'var-1',
          quantity: 3,
          pricePerBox: 100.00
        }
      ]);

      await sleep(10); // Garantir timestamp e ID diferente para a próxima venda

      // Novo saldo deve ser R$ 300,00
      expect(mockDb.fiado.getBalance(clientId)).toBe(300.00);

      // Registrar outra venda no fiado de R$ 150,00
      mockDb.sales.insert(clientId, 'fiado', [
        {
          productId: 'prod-2',
          variantId: null,
          quantity: 3,
          pricePerBox: 50.00
        }
      ]);

      // Saldo deve acumular para R$ 450,00
      expect(mockDb.fiado.getBalance(clientId)).toBe(450.00);

      // Realizar pagamento parcial de R$ 200,00
      mockDb.fiado.pay(clientId, 200.00, 'pix');

      // Saldo restante deve ser R$ 250,00
      expect(mockDb.fiado.getBalance(clientId)).toBe(250.00);
    });

    it('deve amortizar vendas pendentes seguindo a regra FIFO (First In, First Out)', async () => {
      const clientId = 'cli-2';

      // Registrar Venda 1: R$ 100,00 (fiado, pendente)
      const sale1 = mockDb.sales.insert(clientId, 'fiado', [
        {
          productId: 'prod-2',
          variantId: null,
          quantity: 2,
          pricePerBox: 50.00 // Total 100.00
        }
      ]);
      sale1.created_at = new Date(Date.now() - 30000).toISOString(); // 30s atrás

      await sleep(10);

      // Registrar Venda 2: R$ 200,00 (fiado, pendente)
      const sale2 = mockDb.sales.insert(clientId, 'fiado', [
        {
          productId: 'prod-2',
          variantId: null,
          quantity: 2,
          pricePerBox: 100.00 // Total 200.00
        }
      ]);
      sale2.created_at = new Date(Date.now() - 20000).toISOString(); // 20s atrás

      await sleep(10);

      // Registrar Venda 3: R$ 150,00 (fiado, pendente)
      const sale3 = mockDb.sales.insert(clientId, 'fiado', [
        {
          productId: 'prod-2',
          variantId: null,
          quantity: 3,
          pricePerBox: 50.00 // Total 150.00
        }
      ]);
      sale3.created_at = new Date(Date.now() - 10000).toISOString(); // 10s atrás

      // Salvar de volta no mockStore para persistir as datas de criação alteradas
      const allSales = mockStore.getSales();
      const updatedSales = allSales.map(s => {
        if (s.id === sale1.id) return sale1;
        if (s.id === sale2.id) return sale2;
        if (s.id === sale3.id) return sale3;
        return s;
      });
      mockStore.saveSales(updatedSales);

      expect(mockDb.fiado.getBalance(clientId)).toBe(450.00);

      // Pagar R$ 150,00
      mockDb.fiado.pay(clientId, 150.00, 'pix');

      // Saldo total deve cair para R$ 300,00
      expect(mockDb.fiado.getBalance(clientId)).toBe(300.00);

      // Buscar vendas atualizadas do mockStore
      const salesAfterFirstPayment = mockStore.getSales();
      const s1 = salesAfterFirstPayment.find(s => s.id === sale1.id);
      const s2 = salesAfterFirstPayment.find(s => s.id === sale2.id);
      const s3 = salesAfterFirstPayment.find(s => s.id === sale3.id);

      // Venda 1 (R$ 100,00) deve ter sido quitada totalmente (status: pago)
      expect(s1!.status).toBe('pago');
      // Venda 2 (R$ 200,00) continua pendente (pois os R$ 50,00 restantes do pagamento não a quitam totalmente)
      expect(s2!.status).toBe('pendente');
      // Venda 3 (R$ 150,00) continua pendente
      expect(s3!.status).toBe('pendente');

      await sleep(10);

      // Pagar mais R$ 200,00 (Total de pagamentos = R$ 350,00)
      mockDb.fiado.pay(clientId, 200.00, 'dinheiro');

      // Saldo total deve cair para R$ 100,00
      expect(mockDb.fiado.getBalance(clientId)).toBe(100.00);

      const salesAfterSecondPayment = mockStore.getSales();
      const s1_after = salesAfterSecondPayment.find(s => s.id === sale1.id);
      const s2_after = salesAfterSecondPayment.find(s => s.id === sale2.id);
      const s3_after = salesAfterSecondPayment.find(s => s.id === sale3.id);

      // Venda 1: continua paga
      expect(s1_after!.status).toBe('pago');
      // Venda 2: R$ 100 + R$ 200 = R$ 300 alocados. Quita Venda 1 (100) + Venda 2 (200). Deve passar a pago
      expect(s2_after!.status).toBe('pago');
      // Venda 3: acumulado necessário = 450, total pago = 350. Venda 3 continua pendente
      expect(s3_after!.status).toBe('pendente');
    });
  });
});
