# Guia de Infraestrutura — Staging e Backups (BoxHub CRM)

Este documento orienta sobre a configuração do ambiente de testes (Staging) e o processo de salvaguarda de dados (Backups).

---

## 1. Ambiente Separado de Staging (Pré-Crítico)

Operar um ambiente de staging é vital para homologar alterações de faturamento (Stripe), webhooks e migrações SQL sem impactar a base de clientes real.

### Fluxo de Setup
1. **Supabase (Banco Separado):**
   - Crie um segundo projeto no Supabase chamado `boxhub-staging`.
   - Execute o script completo `schema.sql` (e todas as migrações subsequentes) na aba SQL Editor do projeto de staging para inicializar as tabelas, RLS e funções RPC.
   
2. **Stripe (Modo de Testes):**
   - Utilize a conta do Stripe em modo de teste (`Test Mode`).
   - Crie os produtos e preços equivalentes de Staging (Básico/Pro/Anual) e guarde seus Price IDs.
   - Configure o endpoint de webhook em Staging apontando para a URL de staging da Vercel (ex: `https://boxhub-staging.vercel.app/api/stripe/webhook`).
   
3. **Repositório GitHub (Branches):**
   - Mantenha a branch `main` apenas para produção estável.
   - Crie uma branch `staging` a partir de `main`:
     ```bash
     git checkout -b staging
     git push origin staging
     ```
     
4. **Vercel (Deploy do Staging):**
   - Importe o repositório na Vercel e configure um deploy específico ligado à branch `staging`.
   - Sob as configurações de variáveis de ambiente (`Environment Variables`), configure-as no escopo exclusivo de **Preview/Staging** com as chaves do projeto Supabase Staging e Stripe Test Mode:
     - `NEXT_PUBLIC_SUPABASE_URL` (URL do Supabase Staging)
     - `SUPABASE_SERVICE_ROLE_KEY` (Chave de serviço do Supabase Staging)
     - `STRIPE_SECRET_KEY` (Chave secreta de teste do Stripe)
     - `STRIPE_WEBHOOK_SECRET` (Chave secreta do webhook de teste)
     - `NEXT_PUBLIC_STRIPE_PRICE_PRO` / `NEXT_PUBLIC_STRIPE_PRICE_BASIC` (Price IDs do Stripe Staging)

---

## 2. Estratégia de Backups (Crítico)

Enquanto o projeto operar sob o plano gratuito do Supabase, não há backups diários automáticos inclusos no provedor. Para garantir a segurança dos dados, siga um dos procedimentos de backup recomendados abaixo.

### Método A: Exportador em JSON Automatizado (Sem dependências)
Fornecemos um script Node leve (`scratch/backup-supabase.js`) que se conecta ao Supabase usando a chave de serviço administrativa e exporta todas as tabelas em arquivos JSON compactados.
- Para rodar manualmente:
  ```bash
  node scratch/backup-supabase.js
  ```
- Para automatizar: configure um job no GitHub Actions (agendado via cron) que executa este script e faz upload dos arquivos JSON gerados como artefatos protegidos ou os envia para um bucket privado AWS S3 / Google Cloud Storage.

### Método B: Dump Físico SQL via pg_dump
Se você possui o PostgreSQL instalado localmente na sua máquina de desenvolvimento, pode efetuar o dump completo do schema e dados utilizando a Connection String oficial do Supabase:
- **Comando para exportar:**
  ```bash
  pg_dump -h db.your-project-id.supabase.co -U postgres -d postgres -F c -b -v -f boxhub_backup.dump
  ```
- **Comando para restaurar (se necessário):**
  ```bash
  pg_restore -h db.your-project-id.supabase.co -U postgres -d postgres -v boxhub_backup.dump
  ```
  *(Substitua `your-project-id` pelo ID do seu projeto Supabase real)*
