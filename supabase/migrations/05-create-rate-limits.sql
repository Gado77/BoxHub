-- Migração: Criar tabela e RPC de Rate Limiting
-- Caminho: supabase/migrations/05-create-rate-limits.sql

-- 1. Criar a tabela rate_limits
create table if not exists public.rate_limits (
    key text primary key,
    count integer not null default 1,
    reset_time timestamptz not null
);

-- 2. Habilitar RLS e criar política bypass para chamadas pelo Admin SDK ou triggers
alter table public.rate_limits enable row level security;

-- Permitir que superadmins acessem se necessário
create policy "Superadmins can manage rate limits"
    on public.rate_limits for all
    using (public.is_superadmin())
    with check (public.is_superadmin());

-- 3. Criar a função RPC check_rate_limit de gerenciamento atômico
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
    -- Excluir registros expirados antigos para economizar espaço
    delete from public.rate_limits where reset_time < v_now;
    
    -- Tentar incrementar ou criar o registro
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
