export interface OrgSettings {
  estoque_ativo: boolean;
  location?: string;
  phone?: string;
  default_limit?: number;
  logo_url?: string;
  segment?: string;
}

export interface Organization {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled';
  subscription_price_id?: string | null;
  settings: OrgSettings;
  created_at?: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  name: string;
  role: 'admin' | 'vendedor' | 'superadmin';
  avatar_url?: string | null;
  email?: string;
}

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  type: 'quitanda' | 'restaurante' | 'mercado' | 'outro';
  contact: string;
  fiado_limit: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  stock_quantity: number;
  status: 'active' | 'inactive' | 'archived';
  category: string;
  type: 'fruta' | 'legume';
  image_url: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  organization_id: string;
  product_id: string;
  variant_id: string | null;
  type: 'manual_in' | 'manual_out' | 'sale' | 'adjustment' | 'loss';
  quantity: number;
  reference: string;
  notes: string;
  created_at: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  client_id: string | null;
  seller_id: string | null;
  total_amount: number;
  payment_method: 'dinheiro' | 'pix' | 'fiado';
  status: 'pago' | 'pendente';
  is_canceled?: boolean;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  variant_id: string | null;
  quantity: number;
  price_per_box: number;
  total_price: number;
}

export interface FiadoPayment {
  id: string;
  organization_id: string;
  client_id: string;
  amount: number;
  payment_method: 'dinheiro' | 'pix';
  created_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: 'basic' | 'pro' | 'enterprise';
  billing_cycle: 'monthly' | 'annual' | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

