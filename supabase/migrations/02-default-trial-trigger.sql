-- Migração: Criar trigger para criar automaticamente uma assinatura Pro Trial de 7 dias para novas organizações
-- Caminho: supabase/migrations/02-default-trial-trigger.sql

-- 1. Criar a função que lida com o trigger
create or replace function public.handle_new_organization_subscription()
returns trigger as $$
begin
    insert into public.subscriptions (company_id, plan, status, trial_ends_at)
    values (new.id, 'pro', 'trialing', now() + interval '7 days')
    on conflict (company_id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

-- 2. Vincular a função ao trigger after insert na tabela public.organizations
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
    after insert on public.organizations
    for each row
    execute function public.handle_new_organization_subscription();

-- 3. Executar inserção retroativa para quaisquer organizações que ficaram sem registro de assinatura
insert into public.subscriptions (company_id, plan, status, trial_ends_at)
select id, 'pro', 'trialing', created_at + interval '7 days'
from public.organizations o
where not exists (
    select 1 from public.subscriptions s where s.company_id = o.id
)
on conflict (company_id) do nothing;
