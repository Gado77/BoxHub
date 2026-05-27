-- Migração: Criar tabela e triggers de Auditoria
-- Caminho: supabase/migrations/04-create-audit-logs.sql

-- 1. Criar a tabela audit_logs
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

-- 2. Habilitar RLS
alter table public.audit_logs enable row level security;

-- 3. Criar políticas de segurança RLS
drop policy if exists "Users can view audit logs in their organization" on public.audit_logs;
create policy "Users can view audit logs in their organization"
    on public.audit_logs for select
    using (organization_id = public.current_user_org_id());

drop policy if exists "Superadmins can view all audit logs" on public.audit_logs;
create policy "Superadmins can view all audit logs"
    on public.audit_logs for select
    using (public.is_superadmin());

-- 4. Criar índices para performance
create index if not exists idx_audit_logs_org_id on public.audit_logs(organization_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);

-- 5. Trigger Function para Vendas (Cancelamento de Venda)
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

-- Associar trigger na tabela sales
drop trigger if exists on_sale_canceled_audit on public.sales;
create trigger on_sale_canceled_audit
    after update on public.sales
    for each row
    execute function public.process_sales_audit();

-- 6. Trigger Function para Amortização de Fiado
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

-- Associar trigger na tabela fiado_payments
drop trigger if exists on_fiado_payment_audit on public.fiado_payments;
create trigger on_fiado_payment_audit
    after insert on public.fiado_payments
    for each row
    execute function public.process_fiado_payments_audit();

-- 7. Trigger Function para Perfis/Equipe
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

-- Associar trigger na tabela profiles
drop trigger if exists on_profile_audit on public.profiles;
create trigger on_profile_audit
    after insert or update or delete on public.profiles
    for each row
    execute function public.process_profiles_audit();

-- 8. Trigger Function para Assinaturas (Faturamento)
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

-- Associar trigger na tabela subscriptions
drop trigger if exists on_subscription_audit on public.subscriptions;
create trigger on_subscription_audit
    after insert or update on public.subscriptions
    for each row
    execute function public.process_subscriptions_audit();

-- 9. Trigger Function para Configurações do Box
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

-- Associar trigger na tabela organizations
drop trigger if exists on_organization_audit on public.organizations;
create trigger on_organization_audit
    after update on public.organizations
    for each row
    execute function public.process_organizations_audit();
