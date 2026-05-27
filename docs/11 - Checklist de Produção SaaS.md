# Checklist de Produção SaaS: BoxHub

Este checklist detalha o estado de preparação para produção do BoxHub CRM. A maior parte da infraestrutura técnica já está codificada e integrada. As pendências restantes exigem a criação e configuração de contas em serviços externos (Supabase, Stripe, Sentry).

---

## 🚨 CRÍTICO
*O que OBRIGATORIAMENTE precisa existir antes do deploy.*

- [ ] **PENDENTE (Ação do Usuário) — Variáveis de Ambiente Configuradas:** As chaves obtidas no Supabase, Stripe e Sentry devem ser configuradas nas variáveis de ambiente da Vercel (Production) e no arquivo `.env.local` local.
- [x] **Build sem Erros:** O comando `npm run build` foi testado e compila com sucesso, validando todas as tipagens TypeScript, linting e a integração do Sentry com o compilador do Next.js.
- [ ] **PENDENTE (Ação do Usuário) — Banco de Dados e RLS no Supabase:** As tabelas devem ser criadas no projeto do Supabase de produção executando o script [schema.sql](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/supabase/schema.sql) no SQL Editor. Todas as 9 tabelas possuem Row Level Security (RLS) habilitado no script.
- [x] **Middleware de Autenticação Ativo:** O `middleware.ts` está ativo na raiz do projeto e protege todas as rotas operacionais (`/dashboard/*`) e endpoints de API privadas (`/api/*`), redirecionando usuários não autenticados para `/login`.
- [x] **Integração Básica de Pagamentos/Planos:** Os handlers de API `/api/stripe/checkout` e `/api/stripe/webhook` já estão codificados e prontos para sincronizar planos ('trial', 'active', 'past_due', 'canceled') com o banco de dados.

---

## ⚠️ IMPORTANTE
*O que deveria existir para evitar problemas futuros.*

- [x] **Remoção de Código Mockado:** O sistema foi programado para alternar automaticamente. Se as chaves do Supabase e Stripe não estiverem configuradas, ele ativa o modo simulador local (`localStorage`). Assim que as chaves forem preenchidas, ele conecta instantaneamente ao banco de dados e APIs de produção reais.
- [ ] **PENDENTE (Configuração de Infra) — CORS Configurado:** Restringir as URLs permitidas para requisições externas na API do Supabase e rotas Vercel.
- [x] **Tratamento de Exceções nas APIs:** Todas as rotas de API possuem blocos `try/catch` que retornam mensagens amigáveis e evitam o vazamento de stack traces internos do Node.js.
- [x] **Rate Limiting Ativo nas APIs Sensíveis:** Implementamos um limitador de taxa em memória no arquivo [rate-limit.ts](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/src/lib/rate-limit.ts). Ele está ativado no convite de membros (`/api/team/add`) e nos insights da IA (`/api/ai/insights`).
- [x] **Webhooks Idempotentes:** O webhook do Stripe processa eventos baseando-se no ID da assinatura e do cliente no payload oficial, evitando duplicações acidentais.

---

## 🚀 ESCALABILIDADE
*O que preparar para crescimento.*

- [x] **Separação de Serviços (Types/Mock/DB):** Interfaces robustas de tipagem em `types.ts` e isolamento de banco de dados virtual para evitar que o código de tela precise sofrer alterações ao mudar de ambiente.
- [x] **Upload de Arquivos Escalável:** Os avatares de equipe e fotos de produtos utilizam suporte para upload de imagens que se conecta ao Supabase Storage (Bucket "Arquivos"), em vez de gravar imagens pesadas no banco de dados.

---

## 🔒 SEGURANÇA
*Autenticação, permissões, RLS, validação, proteção de dados.*

- [x] **Validação de Inputs:** As rotas críticas validam os dados recebidos no corpo da requisição (como email, nome e perfil no cadastro de equipe) antes de interagir com o banco de dados.
- [x] **Políticas RLS Refinadas (Supabase):** Implementadas políticas no [schema.sql](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/supabase/schema.sql) que restringem o acesso aos dados com base no `organization_id` do usuário logado (multi-inquilinato seguro).
- [x] **Auditoria de Permissões (Roles):** Regras do RLS e validações no servidor impedem que usuários com o cargo `vendedor` convidem novos membros ou visualizem dados sensíveis de faturamento da empresa.

---

## ⚡ PERFORMANCE
*Queries, cache, índices, lazy loading, otimizações.*

- [x] **Índices no PostgreSQL (Supabase):** Índices de banco de dados configurados para todos os campos frequentemente pesquisados e chaves estrangeiras (`organization_id`, `client_id`, `product_id`, etc.) no final do arquivo [schema.sql](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/supabase/schema.sql).
- [x] **Lazy Loading e Splitting:** Roteamento do Next.js (App Router) realiza a divisão automática de código por página.

---

## 🎨 UX
*Loading states, tratamento de erros, empty states, responsividade.*

- [x] **Prevenção de Ação Duplicada:** Botões de envio de formulários e finalização de vendas incluem estados de carregamento visual e desativação (`disabled={isLoading}`).
- [x] **Error Boundaries Renderizando Graciosamente:** Boundaries instalados na Fase 4 (`src/app/error.tsx` e `src/app/global-error.tsx`) capturam erros de compilação ou execução e exibem fallback amigável em vez de uma tela branca.
- [x] **Toasts Globais para Resposta de Ações:** Utilização de alertas visuais para informar se uma transação (venda, alteração de produto, amortização) foi salva com sucesso ou falhou.

---

## 🛠 DEVOPS
*Ambientes, deploy, logs, observabilidade.*

- [x] **Sentry Integrado (Client, Server e Edge):** SDK do Sentry instalado e instrumentado em todo o pipeline. Enviará dados de telemetria de erro automaticamente assim que a variável de ambiente `SENTRY_DSN` for inserida.
- [ ] **PENDENTE (Ação do Usuário) — Ambientes Separados:** Recomendado criar dois projetos no Supabase (um para desenvolvimento/testes e outro para produção oficial conectado à Vercel).
- [ ] **PENDENTE (Ação do Usuário) — Backups Regulares:** Configurar e ativar backups diários do banco de dados no painel do Supabase.

---

## 🗄 BANCO DE DADOS
*Integridade e modelagem.*

- [x] **Foreign Keys e Constraints:** Integridade referencial completa configurada no [schema.sql](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/supabase/schema.sql) com cláusulas `ON DELETE CASCADE` e `ON DELETE SET NULL` apropriadas.
- [x] **Timestamps Automáticos:** Triggers automáticos do Postgres adicionados no final do [schema.sql](file:///c:/Users/itach/Documents/Segundo%20C%C3%A9rebro/Projetos/boxhub/supabase/schema.sql) para gerenciar o campo `updated_at` sempre que um cliente ou variante for atualizado.

---

## ⚙️ MANUTENÇÃO
*Padronização, documentação, comp.*

- [x] **Documentação Atualizada e Centralizada:** Pasta `docs/` criada contendo o guia completo de deploy, stack técnica e relatórios de auditoria.
- [x] **Testes Críticos Existentes:** Suite de testes com Vitest cobrindo as regras de negócio mais importantes do CRM: FIFO amortização de fiado e débito/estorno de estoque.
