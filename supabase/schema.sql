-- BoxHub Database Schema
-- SQL script to initialize tables, relations, and Row Level Security (RLS) policies

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. ORGANIZATIONS (Firma / Box no CEAGESP)
create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    stripe_customer_id text unique,
    subscription_status text not null default 'trial' check (subscription_status in ('trial', 'active', 'past_due', 'canceled')),
    subscription_price_id text,
    settings jsonb not null default '{"estoque_ativo": false}'::jsonb,
    created_at timestamptz not null default now()
);

-- Enable RLS on organizations
alter table public.organizations enable row level security;

-- 2. PROFILES (Users associated with an Organization)
create table public.profiles (
    id uuid primary key references auth.users on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    role text not null default 'admin' check (role in ('admin', 'vendedor', 'superadmin')),
    avatar_url text,
    created_at timestamptz not null default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 3. CLIENTS (Clientes do Box)
create table public.clients (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    type text not null default 'outro' check (type in ('quitanda', 'restaurante', 'mercado', 'outro')),
    contact text, -- WhatsApp / Telefone
    fiado_limit numeric(10,2) not null default 0.00,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS on clients
alter table public.clients enable row level security;

-- 4. PRODUCTS (Frutas e Legumes)
create table public.products (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    description text,
    category text,
    type text not null default 'fruta' check (type in ('fruta', 'legume')),
    status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
    stock_quantity integer not null default 0,
    image_url text,
    archived_at timestamptz,
    created_at timestamptz not null default now()
);

-- Enable RLS on products
alter table public.products enable row level security;

-- 5. PRODUCT VARIANTS (Variantes da Fruta - ex: Maracujá da Bahia)
create table public.product_variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete cascade,
    name text not null,
    stock_quantity integer not null default 0,
    created_at timestamptz not null default now()
);

-- Enable RLS on product_variants
alter table public.product_variants enable row level security;

-- 6. SALES (Registro de Vendas)
create table public.sales (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    seller_id uuid references public.profiles(id) on delete set null,
    total_amount numeric(10,2) not null,
    payment_method text not null check (payment_method in ('dinheiro', 'pix', 'fiado')),
    status text not null default 'pago' check (status in ('pago', 'pendente')), -- 'pendente' se fiado em aberto
    is_canceled boolean not null default false,
    created_at timestamptz not null default now()
);

-- Enable RLS on sales
alter table public.sales enable row level security;

-- 7. SALE ITEMS (Itens vendidos)
create table public.sale_items (
    id uuid primary key default gen_random_uuid(),
    sale_id uuid not null references public.sales(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    variant_id uuid references public.product_variants(id) on delete set null,
    quantity integer not null, -- Caixas
    price_per_box numeric(10,2) not null,
    total_price numeric(10,2) not null,
    created_at timestamptz not null default now()
);

-- Enable RLS on sale_items
alter table public.sale_items enable row level security;

-- 8. FIADO PAYMENTS (Amortizações de fiado)
create table public.fiado_payments (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete cascade,
    amount numeric(10,2) not null,
    payment_method text not null default 'pix' check (payment_method in ('dinheiro', 'pix')),
    created_at timestamptz not null default now()
);

-- Enable RLS on fiado_payments
alter table public.fiado_payments enable row level security;

-- 9. AI INSIGHTS (Cache de insights inteligentes do Claude)
create table public.ai_insights (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    content jsonb not null, -- Array de insights
    created_at timestamptz not null default now()
);

-- Enable RLS on ai_insights
alter table public.ai_insights enable row level security;


-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant isolation based on auth.uid() and profiles organization mapping
-- =========================================================================

-- Helper function to get current user's organization_id from profiles
create or replace function public.current_user_org_id()
returns uuid security definer as $$
begin
    return (select organization_id from public.profiles where id = auth.uid());
end;
$$ language plpgsql;

-- Helper function to check if the current user is a superadmin
create or replace function public.is_superadmin()
returns boolean security definer as $$
begin
    return exists (
        select 1 from public.profiles 
        where id = auth.uid() and role = 'superadmin'
    );
end;
$$ language plpgsql;

-- 1. Policies for profiles (Allow read/write to users in the same organization)
create policy "Users can view profiles in their organization"
    on public.profiles for select
    using (organization_id = public.current_user_org_id());

create policy "Admins can update profiles in their organization"
    on public.profiles for update
    using (organization_id = public.current_user_org_id() and (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Admins can insert profiles in their organization"
    on public.profiles for insert
    with check (organization_id = public.current_user_org_id() and (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Users can insert their own initial profile"
    on public.profiles for insert
    to authenticated
    with check (id = auth.uid());

create policy "Admins can delete profiles in their organization"
    on public.profiles for delete
    using (organization_id = public.current_user_org_id() and (select role from public.profiles where id = auth.uid()) = 'admin');

-- 2. Policies for organizations (Allow users to read their own organization and admins to update)
create policy "Users can view their organization"
    on public.organizations for select
    using (id = public.current_user_org_id());

create policy "Admins can update their organization"
    on public.organizations for update
    using (id = public.current_user_org_id() and (select role from public.profiles where id = auth.uid()) = 'admin');

create policy "Authenticated users can create organizations"
    on public.organizations for insert
    to authenticated
    with check (true);

-- 3. Policies for clients
create policy "Users can manage clients in their organization"
    on public.clients for all
    using (organization_id = public.current_user_org_id())
    with check (organization_id = public.current_user_org_id());

-- 4. Policies for products
create policy "Users can manage products in their organization"
    on public.products for all
    using (organization_id = public.current_user_org_id())
    with check (organization_id = public.current_user_org_id());

-- 5. Policies for product_variants (via product organization ownership)
create policy "Users can manage product variants"
    on public.product_variants for all
    using (product_id in (select id from public.products where organization_id = public.current_user_org_id()))
    with check (product_id in (select id from public.products where organization_id = public.current_user_org_id()));

-- 6. Policies for sales
create policy "Users can manage sales in their organization"
    on public.sales for all
    using (organization_id = public.current_user_org_id())
    with check (organization_id = public.current_user_org_id());

-- 7. Policies for sale_items (via sale organization ownership)
create policy "Users can manage sale items"
    on public.sale_items for all
    using (sale_id in (select id from public.sales where organization_id = public.current_user_org_id()))
    with check (sale_id in (select id from public.sales where organization_id = public.current_user_org_id()));

-- 8. Policies for fiado_payments
create policy "Users can manage fiado payments"
    on public.fiado_payments for all
    using (organization_id = public.current_user_org_id())
    with check (organization_id = public.current_user_org_id());

-- 9. Policies for ai_insights
create policy "Users can manage ai insights"
    on public.ai_insights for all
    using (organization_id = public.current_user_org_id())
    with check (organization_id = public.current_user_org_id());

-- 10. Policies for superadmins (bypass RLS for global views and admin actions)
create policy "Superadmins can select all organizations"
    on public.organizations for select
    using (public.is_superadmin());

create policy "Superadmins can update all organizations"
    on public.organizations for update
    using (public.is_superadmin());

create policy "Superadmins can view all profiles"
    on public.profiles for select
    using (public.is_superadmin());

create policy "Superadmins can view all sales"
    on public.sales for select
    using (public.is_superadmin());

create policy "Superadmins can view all clients"
    on public.clients for select
    using (public.is_superadmin());


-- =========================================================================
-- STORAGE: Bucket policies for logo uploads
-- =========================================================================

-- Ensure the Arquivos bucket exists (ignore if already present)
insert into storage.buckets (id, name, public)
values ('Arquivos', 'Arquivos', true)
on conflict (id) do nothing;

-- Allow public read access to all files in Arquivos
create policy "Public read access for Arquivos"
on storage.objects for select
to public
using (bucket_id = 'Arquivos');

-- Allow authenticated users to upload files to Arquivos/logos/
create policy "Authenticated users can upload logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'Arquivos'
  and (storage.foldername(name))[1] = 'logos'
);

-- Allow authenticated users to update/delete their own logos
create policy "Authenticated users can manage logos"
on storage.objects for update
to authenticated
using (bucket_id = 'Arquivos' and (storage.foldername(name))[1] = 'logos')
with check (bucket_id = 'Arquivos' and (storage.foldername(name))[1] = 'logos');

create policy "Authenticated users can delete logos"
on storage.objects for delete
to authenticated
using (bucket_id = 'Arquivos' and (storage.foldername(name))[1] = 'logos');

-- =========================================================================
-- INDEXES FOR PERFORMANCE
-- =========================================================================
create index if not exists idx_profiles_org_id on public.profiles(organization_id);
create index if not exists idx_clients_org_id on public.clients(organization_id);
create index if not exists idx_products_org_id on public.products(organization_id);
create index if not exists idx_product_variants_prod_id on public.product_variants(product_id);
create index if not exists idx_sales_org_id on public.sales(organization_id);
create index if not exists idx_sales_client_id on public.sales(client_id);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_fiado_payments_org_id on public.fiado_payments(organization_id);
create index if not exists idx_fiado_payments_client_id on public.fiado_payments(client_id);
create index if not exists idx_ai_insights_org_id on public.ai_insights(organization_id);
