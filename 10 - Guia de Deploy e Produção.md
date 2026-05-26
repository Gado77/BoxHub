# Guia de Deploy e Produção (Supabase + Vercel + Stripe + Claude)

Este guia contém as instruções passo a passo para colocar o BoxHub em produção, conectando-o a serviços reais e configurando o domínio personalizado `boxhub.com.br`.

---

## 1. Configurando o Banco de Dados Real (Supabase)

### Passo 1: Criar o Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita ou faça login.
2. Clique em **New Project** e selecione sua organização.
3. Preencha as informações:
   - **Name:** `BoxHub`
   - **Database Password:** Escolha uma senha forte e anote-a.
   - **Region:** Selecione a região mais próxima (ex: *Saúde/São Paulo - sa-east-1*).
4. Aguarde alguns minutos até que o banco de dados seja provisionado.

### Passo 2: Executar a Estrutura de Tabelas (DDL)
1. No painel lateral esquerdo do Supabase, clique em **SQL Editor**.
2. Clique em **New Query** (botão com ícone `+`).
3. Abra o arquivo local `supabase/schema.sql` do código, copie todo o seu conteúdo e cole-o no SQL Editor do Supabase.
4. Clique em **Run** no topo direito.
5. Verifique se todas as tabelas, relacionamentos, funções e políticas RLS foram criados sem erros.

---

## 2. Configurando as Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do seu projeto de código, copiando o arquivo `.env.example` e preenchendo as chaves com os valores reais obtidos do Supabase e de outros provedores:

```env
# Supabase Credentials (Obtidas em Settings > API do Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica

# Supabase Service Role Key (Obtida em Settings > API - Guarde em segredo!)
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada

# Senha padrão para membros adicionados sem convite de e-mail
DEFAULT_MEMBER_PASSWORD=boxhub123

# Stripe Credentials (Privadas - Server Only)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Credentials (Públicas)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (IDs reais do catálogo de produtos do Stripe)
NEXT_PUBLIC_STRIPE_PRICE_BASIC=price_...
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_...

# Anthropic API Key (Para insights inteligentes do Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...

# URL do Aplicativo
NEXT_PUBLIC_APP_URL=https://boxhub.com.br
```

---

## 3. Deploy na Vercel

### Passo 1: Subir o repositório para o GitHub
Certifique-se de que todas as alterações locais estejam salvas e enviadas para o seu repositório do GitHub na branch `main`:
```bash
git add .
git commit -m "feat: preparação de produção, formatação pt-BR e onboarding"
git push origin main
```

### Passo 2: Criar Projeto na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login com a conta do GitHub.
2. Clique em **Add New...** > **Project**.
3. Importe o repositório `boxhub`.
4. Em **Configure Project**:
   - Abra a seção **Environment Variables** e adicione todas as variáveis do seu `.env.local`.
5. Clique em **Deploy**. A Vercel compilará a aplicação Next.js e publicará em um domínio padrão temporário (ex: `boxhub.vercel.app`).

---

## 4. Configurando o Domínio Personalizado (`boxhub.com.br`)

Para associar o domínio profissional `boxhub.com.br` ao seu deploy da Vercel:

### Passo 1: Adicionar o Domínio no Painel da Vercel
1. No painel do seu projeto na Vercel, vá em **Settings** > **Domains**.
2. No campo de texto, digite `boxhub.com.br` e clique em **Add**.
3. A Vercel perguntará se deseja adicionar o subdomínio `www.boxhub.com.br` e redirecionar para o principal. Selecione a opção **recomended** (redirecionar `www` para o principal) e clique em **Add**.

### Passo 2: Configurar o DNS no Registrador de Domínio (ex: Registro.br ou Cloudflare)
A Vercel mostrará os valores de DNS que precisam ser configurados no local onde você comprou o domínio:

1. **Apontamento A (para o domínio principal `boxhub.com.br`):**
   - **Tipo:** `A`
   - **Nome/Host:** `@` (ou vazio)
   - **Valor/Destino:** `76.76.21.21` (IP oficial da Vercel)

2. **Apontamento CNAME (para o subdomínio `www.boxhub.com.br`):**
   - **Tipo:** `CNAME`
   - **Nome/Host:** `www`
   - **Valor/Destino:** `cname.vercel-dns.com`

3. Salve as alterações DNS e aguarde o tempo de propagação (geralmente entre 15 minutos e alguns minutos). A Vercel gerará o certificado SSL (HTTPS) automaticamente assim que a conexão DNS for validada.

---

## 5. Configurando stripe webhook para recebimento de planos

Após configurar o Stripe no Vercel:
1. Vá até o dashboard do Stripe > **Developers** > **Webhooks**.
2. Clique em **Add endpoint**.
3. Cole a URL de webhook em produção: `https://boxhub.com.br/api/stripe/webhook`.
4. Em **Select events to listen to**, adicione:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Salve e copie o **Signing secret** (`whsec_...`) para atualizar no painel de variáveis de ambiente da Vercel como `STRIPE_WEBHOOK_SECRET`.
