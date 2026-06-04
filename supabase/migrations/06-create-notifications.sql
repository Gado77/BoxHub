-- Migration 06-create-notifications.sql
-- Create notifications table and setup RLS policies

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade, -- se nulo, é para toda a org
    title text not null,
    message text not null,
    description text,
    type text not null, -- system, sales, fiado, stock, customer, billing, team
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical', 'positive')),
    source text not null default 'system' check (source in ('system', 'cron', 'billing', 'security', 'insight', 'manual')),
    status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
    is_pinned boolean not null default false,
    action_url text,
    action_label text,
    metadata jsonb not null default '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.notifications enable row level security;

-- Índices de performance
create index if not exists idx_notifications_org_status on public.notifications(organization_id, status);
create index if not exists idx_notifications_user_status on public.notifications(user_id, status);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- Políticas RLS
-- 1. Política de Leitura (SELECT)
create policy "Users can view notifications"
    on public.notifications for select
    using (
        public.is_superadmin()
        or (
            organization_id = public.current_user_org_id()
            and (
                -- admin vê todas as notificações da organização
                (select role from public.profiles where id = auth.uid()) = 'admin'
                -- vendedor vê apenas notificações gerais da org (user_id nulo) ou direcionadas a ele
                or (
                    (select role from public.profiles where id = auth.uid()) = 'vendedor'
                    and (user_id is null or user_id = auth.uid())
                )
            )
        )
    );

-- 2. Política de Atualização (UPDATE)
create policy "Users can update their notifications status"
    on public.notifications for update
    using (
        public.is_superadmin()
        or (
            organization_id = public.current_user_org_id()
            and (
                (select role from public.profiles where id = auth.uid()) = 'admin'
                or (
                    (select role from public.profiles where id = auth.uid()) = 'vendedor'
                    and (user_id is null or user_id = auth.uid())
                )
            )
        )
    )
    with check (
        true
    );

-- Trigger para updated_at automático
create trigger on_notification_update
    before update on public.notifications
    for each row
    execute function public.handle_updated_at();
