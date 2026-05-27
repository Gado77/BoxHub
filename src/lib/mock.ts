import { 
  Organization, 
  Profile, 
  Client, 
  Product, 
  ProductVariant, 
  StockMovement, 
  Sale, 
  SaleItem, 
  FiadoPayment, 
  OrgSettings,
  Subscription
} from './types';

export const DEFAULT_ORG_ID = 'org-ceagesp-123';
export const DEFAULT_USER_ID = 'usr-admin-456';

const initialMockOrgs: Organization[] = [
  {
    id: DEFAULT_ORG_ID,
    name: 'Frutas Prime CEAGESP',
    stripe_customer_id: 'cus_mock123',
    subscription_status: 'trial',
    settings: { estoque_ativo: true },
  },
  {
    id: 'org-system-admin',
    name: 'BoxHub Global',
    stripe_customer_id: null,
    subscription_status: 'active',
    settings: { estoque_ativo: false },
  }
];

const initialMockSubscriptions: Subscription[] = [
  {
    id: 'sub-ceagesp-123',
    company_id: DEFAULT_ORG_ID,
    stripe_customer_id: 'cus_mock123',
    stripe_subscription_id: 'sub_mock123',
    stripe_price_id: 'price_pro_mock',
    plan: 'pro',
    status: 'trialing',
    current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sub-system-admin',
    company_id: 'org-system-admin',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    plan: 'enterprise',
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
    trial_ends_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];


const initialMockProfiles: Profile[] = [
  {
    id: DEFAULT_USER_ID,
    organization_id: DEFAULT_ORG_ID,
    name: 'Roberto Silva (Admin)',
    role: 'admin',
    avatar_url: null,
  },
  {
    id: 'usr-seller-789',
    organization_id: DEFAULT_ORG_ID,
    name: 'Carlos Vendedor',
    role: 'vendedor',
    avatar_url: null,
  },
  {
    id: 'usr-super-999',
    organization_id: 'org-system-admin',
    name: 'Dono do Sistema (SuperAdmin)',
    role: 'superadmin',
    avatar_url: null,
  }
];

const initialMockClients: Client[] = [
  {
    id: 'cli-1',
    organization_id: DEFAULT_ORG_ID,
    name: 'João da Quitanda',
    type: 'quitanda',
    contact: '(11) 99888-7766',
    fiado_limit: 1500.00,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'cli-2',
    organization_id: DEFAULT_ORG_ID,
    name: 'Restaurante Bom Sabor',
    type: 'restaurante',
    contact: '(11) 97777-6655',
    fiado_limit: 3000.00,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cli-3',
    organization_id: DEFAULT_ORG_ID,
    name: 'Mercado Estrela',
    type: 'mercado',
    contact: '(11) 96666-5544',
    fiado_limit: 2000.00,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const initialMockProducts: Product[] = [
  {
    id: 'prod-1',
    organization_id: DEFAULT_ORG_ID,
    name: 'Maracujá',
    description: 'Caixa de maracujá selecionado',
    stock_quantity: 120,
    status: 'active',
    category: 'Maracujá',
    type: 'fruta',
    image_url: null,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-2',
    organization_id: DEFAULT_ORG_ID,
    name: 'Goiaba',
    description: 'Caixa de goiaba vermelha gigante',
    stock_quantity: 8,
    status: 'active',
    category: 'Goiaba',
    type: 'fruta',
    image_url: null,
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-3',
    organization_id: DEFAULT_ORG_ID,
    name: 'Mamão Formosa',
    description: 'Caixa de mamão doce da Bahia',
    stock_quantity: 45,
    status: 'active',
    category: 'Mamão',
    type: 'fruta',
    image_url: null,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-4',
    organization_id: DEFAULT_ORG_ID,
    name: 'Laranja Pera',
    description: 'Caixa de laranja pera selecionada',
    stock_quantity: 200,
    status: 'active',
    category: 'Laranja',
    type: 'fruta',
    image_url: null,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-5',
    organization_id: DEFAULT_ORG_ID,
    name: 'Banana Prata',
    description: 'Banana prata tipo 1',
    stock_quantity: 0,
    status: 'inactive',
    category: 'Banana',
    type: 'fruta',
    image_url: null,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-6',
    organization_id: DEFAULT_ORG_ID,
    name: 'Cenoura',
    description: 'Saco de cenoura selecionada de 20kg',
    stock_quantity: 80,
    status: 'active',
    category: 'Cenoura',
    type: 'legume',
    image_url: null,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
  {
    id: 'prod-7',
    organization_id: DEFAULT_ORG_ID,
    name: 'Batata Monalisa',
    description: 'Saco de batata escovada especial',
    stock_quantity: 150,
    status: 'active',
    category: 'Batata',
    type: 'legume',
    image_url: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    archived_at: null,
  },
];

const initialMockVariants: ProductVariant[] = [
  {
    id: 'var-1',
    product_id: 'prod-1',
    name: 'Da Bahia',
    stock_quantity: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-2',
    product_id: 'prod-1',
    name: 'Do Sul',
    stock_quantity: 70,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-3',
    product_id: 'prod-2',
    name: 'Vermelha',
    stock_quantity: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-4',
    product_id: 'prod-2',
    name: 'Branca',
    stock_quantity: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-5',
    product_id: 'prod-4',
    name: 'Bahia',
    stock_quantity: 200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-6',
    product_id: 'prod-6',
    name: 'Média',
    stock_quantity: 80,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-7',
    product_id: 'prod-7',
    name: 'Lavada',
    stock_quantity: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'var-8',
    product_id: 'prod-7',
    name: 'Suja',
    stock_quantity: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialMockStockMovements: StockMovement[] = [
  {
    id: 'mov-1',
    organization_id: DEFAULT_ORG_ID,
    product_id: 'prod-1',
    variant_id: 'var-1',
    type: 'manual_in',
    quantity: 50,
    reference: 'Entrada inicial',
    notes: 'Estoque inicial da variante',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mov-2',
    organization_id: DEFAULT_ORG_ID,
    product_id: 'prod-1',
    variant_id: 'var-2',
    type: 'manual_in',
    quantity: 70,
    reference: 'Entrada inicial',
    notes: 'Estoque inicial da variante',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mov-3',
    organization_id: DEFAULT_ORG_ID,
    product_id: 'prod-1',
    variant_id: 'var-1',
    type: 'sale',
    quantity: -4,
    reference: 'Venda #392',
    notes: '',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mov-4',
    organization_id: DEFAULT_ORG_ID,
    product_id: 'prod-2',
    variant_id: 'var-3',
    type: 'loss',
    quantity: -2,
    reference: 'Avaria',
    notes: 'Caixa danificada no transporte',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const initialMockSales: Sale[] = [
  {
    id: 'sale-1',
    organization_id: DEFAULT_ORG_ID,
    client_id: 'cli-1',
    seller_id: DEFAULT_USER_ID,
    total_amount: 320.00,
    payment_method: 'pix',
    status: 'pago',
    created_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sale-2',
    organization_id: DEFAULT_ORG_ID,
    client_id: 'cli-2',
    seller_id: DEFAULT_USER_ID,
    total_amount: 1250.00,
    payment_method: 'dinheiro',
    status: 'pago',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sale-3',
    organization_id: DEFAULT_ORG_ID,
    client_id: 'cli-3',
    seller_id: 'usr-seller-789',
    total_amount: 680.00,
    payment_method: 'fiado',
    status: 'pendente',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const initialMockSaleItems: SaleItem[] = [
  {
    id: 'item-1',
    sale_id: 'sale-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    quantity: 4,
    price_per_box: 80.00,
    total_price: 320.00,
  },
  {
    id: 'item-2',
    sale_id: 'sale-2',
    product_id: 'prod-1',
    variant_id: 'var-2',
    quantity: 10,
    price_per_box: 75.00,
    total_price: 750.00,
  },
  {
    id: 'item-3',
    sale_id: 'sale-2',
    product_id: 'prod-2',
    variant_id: null,
    quantity: 10,
    price_per_box: 50.00,
    total_price: 50.00 * 10,
  },
  {
    id: 'item-4',
    sale_id: 'sale-3',
    product_id: 'prod-3',
    variant_id: null,
    quantity: 8,
    price_per_box: 85.00,
    total_price: 680.00,
  }
];

const initialMockFiadoPayments: FiadoPayment[] = [];

const getLocalData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return JSON.parse(JSON.stringify(defaultValue));
  const stored = localStorage.getItem(`boxhub_mock_${key}`);
  if (!stored) {
    localStorage.setItem(`boxhub_mock_${key}`, JSON.stringify(defaultValue));
    return JSON.parse(JSON.stringify(defaultValue));
  }
  try {
    return JSON.parse(stored);
  } catch {
    return JSON.parse(JSON.stringify(defaultValue));
  }
};

const setLocalData = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`boxhub_mock_${key}`, JSON.stringify(value));
};

export const mockStore = {
  getOrgs: () => getLocalData('orgs', initialMockOrgs),
  getProfiles: () => getLocalData('profiles', initialMockProfiles),
  getClients: () => getLocalData('clients', initialMockClients),
  getProducts: () => getLocalData('products', initialMockProducts),
  getVariants: () => getLocalData('variants', initialMockVariants),
  getStockMovements: () => getLocalData('stock_movements', initialMockStockMovements),
  getSales: () => getLocalData('sales', initialMockSales),
  getSaleItems: () => getLocalData('sale_items', initialMockSaleItems),
  getFiadoPayments: () => getLocalData('fiado_payments', initialMockFiadoPayments),
  getSubscriptions: () => getLocalData('subscriptions', initialMockSubscriptions),
  
  saveClients: (clients: Client[]) => setLocalData('clients', clients),
  saveProducts: (products: Product[]) => setLocalData('products', products),
  saveVariants: (variants: ProductVariant[]) => setLocalData('variants', variants),
  saveStockMovements: (movements: StockMovement[]) => setLocalData('stock_movements', movements),
  saveSales: (sales: Sale[]) => setLocalData('sales', sales),
  saveSaleItems: (items: SaleItem[]) => setLocalData('sale_items', items),
  saveFiadoPayments: (payments: FiadoPayment[]) => setLocalData('fiado_payments', payments),
  saveOrgs: (orgs: Organization[]) => setLocalData('orgs', orgs),
  saveProfiles: (profiles: Profile[]) => setLocalData('profiles', profiles),
  saveSubscriptions: (subscriptions: Subscription[]) => setLocalData('subscriptions', subscriptions),

  resetAll: () => {
    if (typeof window === 'undefined') return;
    const keys = ['orgs', 'profiles', 'clients', 'products', 'variants', 'stock_movements', 'sales', 'sale_items', 'fiado_payments', 'subscriptions'];
    keys.forEach(k => localStorage.removeItem(`boxhub_mock_${k}`));
    window.location.reload();
  }
};

export const mockDb = {
  getCurrentUser: () => {
    const profiles = mockStore.getProfiles();
    const currentUserId = typeof window !== 'undefined' 
      ? (localStorage.getItem('boxhub_current_user_id') || DEFAULT_USER_ID)
      : DEFAULT_USER_ID;
    return profiles.find(p => p.id === currentUserId) || profiles[0];
  },
  
  setCurrentUser: (userId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('boxhub_current_user_id', userId);
    }
  },

  getOrg: () => {
    const orgs = mockStore.getOrgs();
    const user = mockDb.getCurrentUser();
    return orgs.find(o => o.id === user.organization_id) || orgs[0];
  },

  subscriptions: {
    get: () => {
      const subs = mockStore.getSubscriptions();
      const org = mockDb.getOrg();
      let sub = subs.find(s => s.company_id === org.id);
      if (!sub) {
        sub = {
          id: `sub-mock-${Date.now()}`,
          company_id: org.id,
          stripe_customer_id: 'cus_mock123',
          stripe_subscription_id: 'sub_mock123',
          stripe_price_id: 'price_pro_mock',
          plan: 'pro',
          status: 'trialing',
          current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cancel_at_period_end: false,
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        subs.push(sub);
        mockStore.saveSubscriptions(subs);
      }
      return sub;
    },
    update: (fields: Partial<Subscription>) => {
      const subs = mockStore.getSubscriptions();
      const org = mockDb.getOrg();
      const idx = subs.findIndex(s => s.company_id === org.id);
      if (idx === -1) return null;
      subs[idx] = { ...subs[idx], ...fields, updated_at: new Date().toISOString() };
      mockStore.saveSubscriptions(subs);
      
      const orgs = mockStore.getOrgs();
      const oIdx = orgs.findIndex(o => o.id === org.id);
      if (oIdx !== -1) {
        orgs[oIdx].subscription_status = fields.status === 'active' ? 'active' : 'trial';
        mockStore.saveOrgs(orgs);
      }

      return subs[idx];
    },
    createDefault: (orgId: string) => {
      const subs = mockStore.getSubscriptions();
      const newSub: Subscription = {
        id: `sub-mock-${Date.now()}`,
        company_id: orgId,
        stripe_customer_id: 'cus_mock_' + Math.random().toString(36).substring(7),
        stripe_subscription_id: 'sub_mock_' + Math.random().toString(36).substring(7),
        stripe_price_id: 'price_pro_mock',
        plan: 'pro',
        status: 'trialing',
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      subs.push(newSub);
      mockStore.saveSubscriptions(subs);
      return newSub;
    }
  },

  updateOrgSettings: (estoqueAtivo: boolean) => {
    const orgs = mockStore.getOrgs();
    const org = mockDb.getOrg();
    org.settings.estoque_ativo = estoqueAtivo;
    const updated = orgs.map(o => o.id === org.id ? org : o);
    mockStore.saveOrgs(updated);
    return org;
  },

  updateOrg: (name: string, settingsData: Partial<OrgSettings>) => {
    const orgs = mockStore.getOrgs();
    const org = mockDb.getOrg();
    org.name = name;
    org.settings = { ...org.settings, ...settingsData };
    const updated = orgs.map(o => o.id === org.id ? org : o);
    mockStore.saveOrgs(updated);
    return org;
  },

  updateOrgLogo: (logoUrl: string) => {
    const orgs = mockStore.getOrgs();
    const org = mockDb.getOrg();
    org.settings = { ...org.settings, logo_url: logoUrl };
    const updated = orgs.map(o => o.id === org.id ? org : o);
    mockStore.saveOrgs(updated);
    return org;
  },

  profiles: {
    list: () => {
      const all = mockStore.getProfiles();
      const org = mockDb.getOrg();
      return all.filter(p => p.organization_id === org.id);
    },
    update: (profileId: string, name: string, role: 'admin' | 'vendedor' | 'superadmin') => {
      const all = mockStore.getProfiles();
      const idx = all.findIndex(p => p.id === profileId);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], name, role };
      mockStore.saveProfiles(all);
      return all[idx];
    },
    remove: (profileId: string) => {
      const all = mockStore.getProfiles();
      const filtered = all.filter(p => p.id !== profileId);
      mockStore.saveProfiles(filtered);
    }
  },

  clients: {
    list: () => {
      const all = mockStore.getClients();
      const org = mockDb.getOrg();
      return all.filter(c => c.organization_id === org.id);
    },
    insert: (name: string, type: 'quitanda' | 'restaurante' | 'mercado' | 'outro', contact: string, fiadoLimit: number) => {
      const all = mockStore.getClients();
      const org = mockDb.getOrg();
      const newClient: Client = {
        id: `cli-${Date.now()}`,
        organization_id: org.id,
        name,
        type,
        contact,
        fiado_limit: fiadoLimit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      all.push(newClient);
      mockStore.saveClients(all);
      return newClient;
    }
  },

  products: {
    list: () => {
      const all = mockStore.getProducts();
      const org = mockDb.getOrg();
      return all.filter(p => p.organization_id === org.id);
    },
    get: (productId: string) => {
      const all = mockStore.getProducts();
      return all.find(p => p.id === productId) || null;
    },
    variants: (productId: string) => {
      const all = mockStore.getVariants();
      return all.filter(v => v.product_id === productId);
    },
    getTotalStock: (productId: string) => {
      const variants = mockStore.getVariants().filter(v => v.product_id === productId);
      if (variants.length > 0) {
        return variants.reduce((sum, v) => sum + v.stock_quantity, 0);
      }
      const product = mockStore.getProducts().find(p => p.id === productId);
      return product ? product.stock_quantity : 0;
    },
    insert: (name: string, description: string, initialStock = 0, category = '', type: 'fruta' | 'legume' = 'fruta') => {
      const all = mockStore.getProducts();
      const org = mockDb.getOrg();
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        organization_id: org.id,
        name,
        description,
        stock_quantity: initialStock,
        status: 'active',
        category,
        type,
        image_url: null,
        created_at: new Date().toISOString(),
        archived_at: null,
      };
      all.push(newProduct);
      mockStore.saveProducts(all);
      return newProduct;
    },
    update: (productId: string, data: Partial<Product>) => {
      const all = mockStore.getProducts();
      const idx = all.findIndex(p => p.id === productId);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...data };
      mockStore.saveProducts(all);
      return all[idx];
    },
    remove: (productId: string) => {
      const all = mockStore.getProducts();
      const idx = all.findIndex(p => p.id === productId);
      if (idx === -1) return;
      all[idx].status = 'archived';
      all[idx].archived_at = new Date().toISOString();
      mockStore.saveProducts(all);
    },
    hardDelete: (productId: string) => {
      const all = mockStore.getProducts();
      mockStore.saveProducts(all.filter(p => p.id !== productId));
    },
    insertVariant: (productId: string, name: string, initialStock = 0) => {
      const all = mockStore.getVariants();
      const newVariant: ProductVariant = {
        id: `var-${Date.now()}`,
        product_id: productId,
        name,
        stock_quantity: initialStock,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      all.push(newVariant);
      mockStore.saveVariants(all);

      const products = mockStore.getProducts();
      const parent = products.find(p => p.id === productId);
      if (parent) {
        parent.stock_quantity = mockDb.products.getTotalStock(productId);
        mockStore.saveProducts(products);
      }

      return newVariant;
    },
    updateVariant: (variantId: string, data: Partial<ProductVariant>) => {
      const all = mockStore.getVariants();
      const idx = all.findIndex(v => v.id === variantId);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], ...data, updated_at: new Date().toISOString() };
      mockStore.saveVariants(all);

      const parent = mockStore.getProducts().find(p => p.id === all[idx].product_id);
      if (parent) {
        parent.stock_quantity = mockDb.products.getTotalStock(parent.id);
        mockStore.saveProducts(mockStore.getProducts());
      }

      return all[idx];
    },
    removeVariant: (variantId: string) => {
      const all = mockStore.getVariants();
      const variant = all.find(v => v.id === variantId);
      if (!variant) return;
      mockStore.saveVariants(all.filter(v => v.id !== variantId));

      const products = mockStore.getProducts();
      const parent = products.find(p => p.id === variant.product_id);
      if (parent) {
        parent.stock_quantity = mockDb.products.getTotalStock(parent.id);
        mockStore.saveProducts(products);
      }
    },
  },

  stockMovements: {
    list: (productId: string) => {
      const all = mockStore.getStockMovements();
      return all.filter(m => m.product_id === productId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    add: (movement: Omit<StockMovement, 'id' | 'organization_id'>) => {
      const all = mockStore.getStockMovements();
      const org = mockDb.getOrg();
      const newMovement: StockMovement = {
        ...movement,
        id: `mov-${Date.now()}`,
        organization_id: org.id,
      };
      all.push(newMovement);
      mockStore.saveStockMovements(all);

      if (movement.variant_id) {
        const variants = mockStore.getVariants();
        const variant = variants.find(v => v.id === movement.variant_id);
        if (variant) {
          variant.stock_quantity = Math.max(0, variant.stock_quantity + movement.quantity);
          variant.updated_at = new Date().toISOString();
          mockStore.saveVariants(variants);
        }
      } else {
        const products = mockStore.getProducts();
        const product = products.find(p => p.id === movement.product_id);
        if (product) {
          product.stock_quantity = Math.max(0, product.stock_quantity + movement.quantity);
          mockStore.saveProducts(products);
        }
      }

      const products = mockStore.getProducts();
      const parent = products.find(p => p.id === movement.product_id);
      if (parent) {
        const totalFromVariants = mockStore.getVariants()
          .filter(v => v.product_id === movement.product_id)
          .reduce((sum, v) => sum + v.stock_quantity, 0);
        if (totalFromVariants > 0 || mockStore.getVariants().some(v => v.product_id === movement.product_id)) {
          parent.stock_quantity = totalFromVariants;
        }
        mockStore.saveProducts(products);
      }

      return newMovement;
    },
    listAll: () => {
      const all = mockStore.getStockMovements();
      const org = mockDb.getOrg();
      return all.filter(m => m.organization_id === org.id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  },

  sales: {
    list: () => {
      const all = mockStore.getSales();
      const org = mockDb.getOrg();
      return all.filter(s => s.organization_id === org.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    items: (saleId: string) => {
      const all = mockStore.getSaleItems();
      return all.filter(item => item.sale_id === saleId);
    },
    insert: (clientId: string | null, paymentMethod: 'dinheiro' | 'pix' | 'fiado', items: { productId: string, variantId: string | null, quantity: number, pricePerBox: number }[]) => {
      const sales = mockStore.getSales();
      const saleItems = mockStore.getSaleItems();
      const org = mockDb.getOrg();
      const user = mockDb.getCurrentUser();
      
      const totalAmount = items.reduce((acc, curr) => acc + (curr.quantity * curr.pricePerBox), 0);
      const saleId = `sale-${Date.now()}`;
      
      const newSale: Sale = {
        id: saleId,
        organization_id: org.id,
        client_id: clientId,
        seller_id: user.id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        status: paymentMethod === 'fiado' ? 'pendente' : 'pago',
        created_at: new Date().toISOString()
      };

      sales.push(newSale);
      mockStore.saveSales(sales);

      const products = mockStore.getProducts();
      const variants = mockStore.getVariants();

      items.forEach((item, index) => {
        const newItem: SaleItem = {
          id: `item-${Date.now()}-${index}`,
          sale_id: saleId,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          price_per_box: item.pricePerBox,
          total_price: item.quantity * item.pricePerBox
        };
        saleItems.push(newItem);

        if (org.settings.estoque_ativo) {
          if (item.variantId) {
            const variantObj = variants.find(v => v.id === item.variantId);
            if (variantObj) {
              variantObj.stock_quantity = Math.max(0, variantObj.stock_quantity - item.quantity);
            }
          }
          const productObj = products.find(p => p.id === item.productId);
          if (productObj) {
            productObj.stock_quantity = Math.max(0, productObj.stock_quantity - item.quantity);
          }
        }
      });

      mockStore.saveSaleItems(saleItems);
      if (org.settings.estoque_ativo) {
        mockStore.saveProducts(products);
        mockStore.saveVariants(variants);
      }

      if (clientId) {
        const clients = mockStore.getClients();
        const client = clients.find(c => c.id === clientId);
        if (client) {
          client.updated_at = new Date().toISOString();
          mockStore.saveClients(clients);
        }
      }

      return newSale;
    },
    cancel: (saleId: string) => {
      const sales = mockStore.getSales();
      const idx = sales.findIndex(s => s.id === saleId);
      if (idx === -1) return null;
      if (sales[idx].is_canceled) return sales[idx];

      sales[idx].is_canceled = true;
      mockStore.saveSales(sales);

      const org = mockDb.getOrg();
      if (org.settings.estoque_ativo) {
        const saleItems = mockDb.sales.items(saleId);
        const products = mockStore.getProducts();
        const variants = mockStore.getVariants();

        saleItems.forEach(item => {
          if (item.variant_id) {
            const variantObj = variants.find(v => v.id === item.variant_id);
            if (variantObj) {
              variantObj.stock_quantity = variantObj.stock_quantity + item.quantity;
            }
          }
          if (item.product_id) {
            const productObj = products.find(p => p.id === item.product_id);
            if (productObj) {
              productObj.stock_quantity = productObj.stock_quantity + item.quantity;
            }
          }
        });

        mockStore.saveProducts(products);
        mockStore.saveVariants(variants);
      }

      return sales[idx];
    }
  },

  fiado: {
    paymentsList: () => {
      const all = mockStore.getFiadoPayments();
      const org = mockDb.getOrg();
      return all.filter(p => p.organization_id === org.id);
    },
    getBalance: (clientId: string) => {
      const sales = mockStore.getSales().filter(s => s.client_id === clientId && s.payment_method === 'fiado' && !s.is_canceled);
      const payments = mockStore.getFiadoPayments().filter(p => p.client_id === clientId);
      
      const totalDebt = sales.reduce((acc, curr) => acc + Number(curr.total_amount), 0);
      const totalAmortized = payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      return Math.max(0, totalDebt - totalAmortized);
    },
    pay: (clientId: string, amount: number, paymentMethod: 'dinheiro' | 'pix') => {
      const payments = mockStore.getFiadoPayments();
      const org = mockDb.getOrg();
      
      const newPayment: FiadoPayment = {
        id: `pay-${Date.now()}`,
        organization_id: org.id,
        client_id: clientId,
        amount,
        payment_method: paymentMethod,
        created_at: new Date().toISOString()
      };
      
      payments.push(newPayment);
      mockStore.saveFiadoPayments(payments);

      const sales = mockStore.getSales();
      const clientSales = sales.filter(s => s.client_id === clientId && s.payment_method === 'fiado' && !s.is_canceled)
                               .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      const allPaymentsSum = mockStore.getFiadoPayments().filter(p => p.client_id === clientId).reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      let allocated = 0;
      for (const sale of clientSales) {
        allocated += Number(sale.total_amount);
        if (allPaymentsSum >= allocated) {
          sale.status = 'pago';
        } else {
          sale.status = 'pendente';
        }
      }
      
      mockStore.saveSales(sales);
      return newPayment;
    }
  }
};
