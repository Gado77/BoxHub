-- Migração: Adicionar coluna billing_cycle na tabela subscriptions
-- Caminho: supabase/migrations/03-add-billing-cycle.sql

-- 1. Adicionar a coluna billing_cycle com a restrição check
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS billing_cycle text CHECK (billing_cycle IN ('monthly', 'annual'));

-- 2. Atualizar a função handle_new_organization_subscription para definir o valor padrão 'monthly' no insert do trial
CREATE OR REPLACE FUNCTION public.handle_new_organization_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (company_id, plan, status, trial_ends_at, billing_cycle)
    VALUES (new.id, 'pro', 'trialing', now() + interval '7 days', 'monthly')
    ON CONFLICT (company_id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar registros existentes que tenham a coluna billing_cycle vazia para 'monthly'
UPDATE public.subscriptions 
SET billing_cycle = 'monthly' 
WHERE billing_cycle IS NULL;
