-- Migration 07-add-asaas-columns.sql
-- Adiciona colunas do Asaas às tabelas subscriptions e organizations, e cria a tabela webhook_events para idempotência

-- 1. Alterar tabela organizations
alter table public.organizations 
    add column if not exists asaas_customer_id text unique;

-- 2. Alterar tabela subscriptions
alter table public.subscriptions 
    add column if not exists asaas_customer_id text unique,
    add column if not exists asaas_subscription_id text unique,
    add column if not exists billing_provider text not null default 'stripe' check (billing_provider in ('stripe', 'asaas'));

-- 3. Criar tabela de idempotência webhook_events
create table if not exists public.webhook_events (
    id text primary key,
    provider text not null check (provider in ('stripe', 'asaas')),
    status text not null default 'processed' check (status in ('processing', 'processed', 'failed')),
    processed_at timestamptz not null default now()
);

-- Habilitar RLS na tabela webhook_events
alter table public.webhook_events enable row level security;

-- Políticas de RLS para webhook_events
create policy "Superadmins can view webhook events"
    on public.webhook_events for select
    using (public.is_superadmin());

-- Adicionar índices de busca rápida para faturamento do Asaas
create index if not exists idx_organizations_asaas_cust on public.organizations(asaas_customer_id);
create index if not exists idx_subscriptions_asaas_cust on public.subscriptions(asaas_customer_id);
create index if not exists idx_subscriptions_asaas_sub on public.subscriptions(asaas_subscription_id);
create index if not exists idx_subscriptions_provider on public.subscriptions(billing_provider);
