# Estrutura do Banco de Dados (Supabase)

O esquema de banco de dados do BoxHub é multi-tenant. Cada usuário pertence a uma organização (Firma/Box) e os dados são protegidos por Row Level Security (RLS) para garantir que um Box nunca veja os dados de outro.

---

## Tabelas e Relacionamentos

Abaixo está o resumo das tabelas definidas no script [supabase/schema.sql](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/supabase/schema.sql):

### 1. `organizations` (Firmas/Boxes)
- `id` (uuid, PK)
- `name` (text) - Nome do Box / Razão Social
- `subscription_status` (text) - Status SaaS (`trial`, `active`, `past_due`, `canceled`)
- `settings` (jsonb) - Configurações personalizadas (ex: `{"estoque_ativo": true/false}`)
- `stripe_customer_id` (text)
- `subscription_price_id` (text)

### 2. `profiles` (Usuários / Colaboradores do Box)
- `id` (uuid, PK, ref `auth.users`)
- `organization_id` (uuid, FK ref `organizations`)
- `name` (text)
- `role` (text) - Cargo na firma (`admin` ou `vendedor`)

### 3. `clients` (Clientes da carteira)
- `id` (uuid, PK)
- `organization_id` (uuid, FK ref `organizations`)
- `name` (text) - Nome fantasia do comprador
- `type` (text) - Tipo de firma (`quitanda`, `restaurante`, `mercado`, `outro`)
- `contact` (text) - Telefone/WhatsApp
- `fiado_limit` (numeric) - Limite disponível para compras a prazo

### 4. `products` (Catálogo de Frutas)
- `id` (uuid, PK)
- `organization_id` (uuid, FK ref `organizations`)
- `name` (text) - Nome da fruta (ex: Manga, Goiaba)
- `description` (text)
- `stock_quantity` (integer) - Quantidade física em estoque (somatório de variantes se houver)

### 5. `product_variants` (Variantes das Frutas)
- `id` (uuid, PK)
- `product_id` (uuid, FK ref `products`)
- `name` (text) - Nome da variação (ex: Da Bahia, Palmer, Tommy)
- `stock_quantity` (integer) - Estoque específico da variante

### 6. `sales` (Registro de Vendas)
- `id` (uuid, PK)
- `organization_id` (uuid, FK ref `organizations`)
- `client_id` (uuid, FK ref `clients`, opcional)
- `seller_id` (uuid, FK ref `profiles`)
- `total_amount` (numeric)
- `payment_method` (text) - `dinheiro`, `pix` ou `fiado`
- `status` (text) - `pago` ou `pendente`

### 7. `sale_items` (Itens do Carrinho da Venda)
- `id` (uuid, PK)
- `sale_id` (uuid, FK ref `sales`)
- `product_id` (uuid, FK ref `products`)
- `variant_id` (uuid, FK ref `product_variants`, opcional)
- `quantity` (integer) - Quantidade de caixas vendidas
- `price_per_box` (numeric) - Preço unitário por caixa
- `total_price` (numeric)

### 8. `fiado_payments` (Recebimentos / Amortização de Fiado)
- `id` (uuid, PK)
- `organization_id` (uuid, FK ref `organizations`)
- `client_id` (uuid, FK ref `clients`)
- `amount` (numeric) - Valor pago pelo cliente
- `payment_method` (text) - `dinheiro` ou `pix`
- `created_at` (timestamp)

---

## Segurança (Row Level Security - RLS)

Todas as consultas filtram os registros utilizando a função auxiliar do Supabase:
```sql
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid AS $$
  SELECT organization_id FROM public.profiles 
  WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

Políticas aplicadas nas tabelas:
- **SELECT/INSERT/UPDATE:** Apenas permitidos se o `organization_id` do registro coincidir com o retornado por `current_user_org_id()`.
- **Exceção de Admin:** Apenas profiles com `role = 'admin'` podem alterar configurações da organização ou convidar novos membros para a equipe.
