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
    email text,
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
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
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

-- =========================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =========================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_client_update
    before update on public.clients
    for each row
    execute function public.handle_updated_at();

create trigger on_product_variant_update
    before update on public.product_variants
    for each row
    execute function public.handle_updated_at();

-- =========================================================================
-- 10. BILLING / SUBSCRIPTIONS
-- =========================================================================
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.organizations(id) on delete cascade unique,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    stripe_price_id text,
    plan text not null check (plan in ('basic', 'pro', 'enterprise')),
    billing_cycle text check (billing_cycle in ('monthly', 'annual')),
    status text not null,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    trial_ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable RLS on subscriptions
alter table public.subscriptions enable row level security;

-- Policies for subscriptions
create policy "Users can view their organization's subscription"
    on public.subscriptions for select
    using (company_id = public.current_user_org_id());

create policy "Superadmins can manage all subscriptions"
    on public.subscriptions for all
    using (public.is_superadmin())
    with check (public.is_superadmin());

-- Trigger updated_at for subscriptions
create trigger on_subscription_update
    before update on public.subscriptions
    for each row
    execute function public.handle_updated_at();

-- Indexes for subscriptions
create index if not exists idx_subscriptions_company_id on public.subscriptions(company_id);
create index if not exists idx_subscriptions_stripe_sub_id on public.subscriptions(stripe_subscription_id);


-- =========================================================================
-- 11. AUDIT LOGS & TRIGGERS
-- =========================================================================
create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    action text not null,
    entity text not null,
    entity_id uuid,
    metadata jsonb,
    created_at timestamptz not null default now()
);

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;

-- Policies for audit_logs
create policy "Users can view audit logs in their organization"
    on public.audit_logs for select
    using (organization_id = public.current_user_org_id());

create policy "Superadmins can view all audit logs"
    on public.audit_logs for select
    using (public.is_superadmin());

-- Indexes for audit_logs
create index if not exists idx_audit_logs_org_id on public.audit_logs(organization_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

-- Trigger Function for Sales cancellation
create or replace function public.process_sales_audit()
returns trigger as $$
begin
    if (new.is_canceled = true and (old.is_canceled = false or old.is_canceled is null)) then
        insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
        values (
            new.organization_id,
            auth.uid(),
            'cancel_sale',
            'sales',
            new.id,
            jsonb_build_object(
                'total_amount', new.total_amount,
                'client_id', new.client_id,
                'payment_method', new.payment_method
            )
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_sale_canceled_audit
    after update on public.sales
    for each row
    execute function public.process_sales_audit();

-- Trigger Function for Fiado Payments (Amortização)
create or replace function public.process_fiado_payments_audit()
returns trigger as $$
begin
    insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
    values (
        new.organization_id,
        auth.uid(),
        'create_fiado_payment',
        'fiado_payments',
        new.id,
        jsonb_build_object(
            'amount', new.amount,
            'client_id', new.client_id,
            'payment_method', new.payment_method
        )
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_fiado_payment_audit
    after insert on public.fiado_payments
    for each row
    execute function public.process_fiado_payments_audit();

-- Trigger Function for Profiles/Team
create or replace function public.process_profiles_audit()
returns trigger as $$
begin
    if (tg_op = 'INSERT') then
        insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
        values (
            new.organization_id,
            auth.uid(),
            'add_member',
            'profiles',
            new.id,
            jsonb_build_object(
                'name', new.name,
                'role', new.role,
                'email', new.email
            )
        );
    elsif (tg_op = 'DELETE') then
        insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
        values (
            old.organization_id,
            auth.uid(),
            'remove_member',
            'profiles',
            old.id,
            jsonb_build_object(
                'name', old.name,
                'role', old.role,
                'email', old.email
            )
        );
    elsif (tg_op = 'UPDATE') then
        if (old.role <> new.role or old.name <> new.name or old.email <> new.email) then
            insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
            values (
                new.organization_id,
                auth.uid(),
                'update_member',
                'profiles',
                new.id,
                jsonb_build_object(
                    'old_name', old.name,
                    'new_name', new.name,
                    'old_role', old.role,
                    'new_role', new.role,
                    'old_email', old.email,
                    'new_email', new.email
                )
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_audit
    after insert or update or delete on public.profiles
    for each row
    execute function public.process_profiles_audit();

-- Trigger Function for Subscriptions
create or replace function public.process_subscriptions_audit()
returns trigger as $$
begin
    if (tg_op = 'INSERT') then
        insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
        values (
            new.company_id,
            auth.uid(),
            'create_subscription',
            'subscriptions',
            new.id,
            jsonb_build_object(
                'plan', new.plan,
                'billing_cycle', new.billing_cycle,
                'status', new.status
            )
        );
    elsif (tg_op = 'UPDATE') then
        if (old.plan <> new.plan or old.billing_cycle <> new.billing_cycle or old.status <> new.status) then
            insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
            values (
                new.company_id,
                auth.uid(),
                'update_subscription',
                'subscriptions',
                new.id,
                jsonb_build_object(
                    'old_plan', old.plan,
                    'new_plan', new.plan,
                    'old_billing_cycle', old.billing_cycle,
                    'new_billing_cycle', new.billing_cycle,
                    'old_status', old.status,
                    'new_status', new.status
                )
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_subscription_audit
    after insert or update on public.subscriptions
    for each row
    execute function public.process_subscriptions_audit();

-- Trigger Function for Box/Organization Settings
create or replace function public.process_organizations_audit()
returns trigger as $$
begin
    if (tg_op = 'UPDATE') then
        if (old.settings <> new.settings or old.name <> new.name) then
            insert into public.audit_logs (organization_id, user_id, action, entity, entity_id, metadata)
            values (
                new.id,
                auth.uid(),
                'update_organization',
                'organizations',
                new.id,
                jsonb_build_object(
                    'old_name', old.name,
                    'new_name', new.name,
                    'old_settings', old.settings,
                    'new_settings', new.settings
                )
            );
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer;

create trigger on_organization_audit
    after update on public.organizations
    for each row
    execute function public.process_organizations_audit();


-- =========================================================================
-- 12. RATE LIMITING
-- =========================================================================
create table if not exists public.rate_limits (
    key text primary key,
    count integer not null default 1,
    reset_time timestamptz not null
);

-- Enable RLS
alter table public.rate_limits enable row level security;

-- Policies for rate_limits
create policy "Superadmins can manage rate limits"
    on public.rate_limits for all
    using (public.is_superadmin())
    with check (public.is_superadmin());

-- Atomic Rate Limiter function RPC
create or replace function public.check_rate_limit(
    p_key text,
    p_limit integer,
    p_window_ms integer
) returns jsonb security definer as $$
declare
    v_now timestamptz := now();
    v_reset_time timestamptz;
    v_count integer;
    v_success boolean;
begin
    delete from public.rate_limits where reset_time < v_now;
    
    insert into public.rate_limits (key, count, reset_time)
    values (p_key, 1, v_now + (p_window_ms || ' milliseconds')::interval)
    on conflict (key) do update
    set count = case 
        when rate_limits.reset_time < v_now then 1 
        else rate_limits.count + 1 
    end,
    reset_time = case 
        when rate_limits.reset_time < v_now then v_now + (p_window_ms || ' milliseconds')::interval 
        else rate_limits.reset_time 
    end
    returning rate_limits.count, rate_limits.reset_time into v_count, v_reset_time;
    
    if v_count > p_limit then
        v_success := false;
    else
        v_success := true;
    end if;
    
    return jsonb_build_object(
        'success', v_success,
        'limit', p_limit,
        'remaining', greatest(0, p_limit - v_count),
        'reset', extract(epoch from v_reset_time) * 1000
    );
end;
$$ language plpgsql;



