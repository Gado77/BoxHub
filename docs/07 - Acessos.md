	# Acessos e Credenciais

Este documento centraliza as instruções de login e acesso ao painel do BoxHub, tanto no ambiente de demonstração local quanto no ambiente real.

---

## 1. Acesso no Modo Demonstração (Mock offline)

No modo de simulação, você não precisa de internet para autenticar. Pode usar qualquer e-mail e senha para logar ou cadastrar.

### Contas de Teste Pré-carregadas:

#### Administrador do Box (Admin)
- **E-mail:** `admin@boxhub.com.br`
- **Senha:** `123456`
- **Função:** Permite alterar estoque nas configurações, adicionar vendedores e simular planos Stripe.

#### Vendedor do Box
- **E-mail:** `vendedor@boxhub.com.br`
- **Senha:** `123456`
- **Função:** Permite registrar vendas e amortizar fiado. O formulário para adicionar novos membros em Configurações fica bloqueado.

---

## 2. Modelo de Configuração de Produção (`.env.local`)

Quando conectado ao banco em nuvem, crie o arquivo `.env.local` na raiz da pasta do código com a seguinte estrutura:

```env
# URL E CHAVE PÚBLICA DO SUPABASE (Acesso do Cliente)
NEXT_PUBLIC_SUPABASE_URL=https://seu-id-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# CHAVE PRIVADA SUPABASE SERVICE ROLE (Acesso exclusivo do servidor para Webhooks e IA)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# INTEGRAÇÃO DE PAGAMENTOS STRIPE
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...

# INTELIGÊNCIA ARTIFICIAL ANTHROPIC CLAUDE
ANTHROPIC_API_KEY=sk-ant-api03-...

# URL BASE DO SISTEMA (Para redirecionamentos do Stripe)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
