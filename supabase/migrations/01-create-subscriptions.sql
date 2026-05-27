-- Migração: Criar tabela de assinaturas (subscriptions)
-- Caminho: supabase/migrations/01-create-subscriptions.sql

-- 1. Criar a tabela subscriptions
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.organizations(id) on delete cascade unique,
    stripe_customer_id text unique,
    stripe_subscription_id text unique,
    stripe_price_id text,
    plan text not null check (plan in ('basic', 'pro', 'enterprise')),
    status text not null,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    trial_ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Migrar organizações existentes para o plano Pro em modo Trial de 7 dias
insert into public.subscriptions (company_id, plan, status, trial_ends_at, created_at, updated_at)
select 
    id, 
    'pro' as plan, 
    'trialing' as status, 
    created_at + interval '7 days' as trial_ends_at, 
    created_at, 
    created_at
from public.organizations
on conflict (company_id) do nothing;

-- 3. Habilitar RLS (Row Level Security)
alter table public.subscriptions enable row level security;

-- 4. Criar políticas de segurança RLS
drop policy if exists "Users can view their organization's subscription" on public.subscriptions;
create policy "Users can view their organization's subscription"
    on public.subscriptions for select
    using (company_id = public.current_user_org_id());

drop policy if exists "Superadmins can manage all subscriptions" on public.subscriptions;
create policy "Superadmins can manage all subscriptions"
    on public.subscriptions for all
    using (public.is_superadmin())
    with check (public.is_superadmin());

-- 5. Criar triggers de atualização automática do campo updated_at
drop trigger if exists on_subscription_update on public.subscriptions;
create trigger on_subscription_update
    before update on public.subscriptions
    for each row
    execute function public.handle_updated_at();

-- 6. Índices para otimização de busca
create index if not exists idx_subscriptions_company_id on public.subscriptions(company_id);
create index if not exists idx_subscriptions_stripe_sub_id on public.subscriptions(stripe_subscription_id);
