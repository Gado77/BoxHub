# Status do Projeto e Checklist de Produção

O projeto encontra-se com o MVP **100% desenvolvido e compilando com sucesso** no ambiente local.

---

## Estado Atual do MVP
- **Build de Produção:** Testado e aprovado com sucesso via `npm run build`.
- **Funcionamento Local:** Totalmente funcional em modo Sandbox (Mock) com persistência em `localStorage`.
- **Central de SuperAdmin:** 100% concluída, integrada ao Supabase real com visualização global de empresas, faturamento acumulado, latência e uso de disco PostgreSQL.
- **Segurança de Banco e RLS:** Políticas do Supabase atualizadas em `schema.sql` para liberar consultas globais do SuperAdmin sem expor o banco de dados.
- **Correções de Login e Autenticação:** Tratamento de login rápido com role superadmin, badge de banco ativo, e correção de bug de sessão travada caso o perfil seja excluído no backend.

---

## Checklist para Ativar o Banco de Dados Real (Supabase)

Quando decidir sair do modo de simulação (Mock) e conectar o BoxHub ao banco de dados em nuvem:

### 1. Criar Projeto Supabase
- Cadastre-se em [supabase.com](https://supabase.com).
- Crie um novo projeto (ex: *BoxHub*).
- Copie a **URL do Projeto** e a **chave API Anon (pública)**.

### 2. Rodar Estrutura de Tabelas (SQL)
- No painel do Supabase, acesse a aba **SQL Editor**.
- Crie uma nova query, copie o conteúdo do arquivo [supabase/schema.sql](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/supabase/schema.sql) e clique em **Run**.
- Isso criará todas as tabelas, relacionamentos e as políticas RLS de segurança automaticamente.

### 3. Configurar Variáveis de Ambiente
- Na raiz do projeto de código [boxhub](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub), crie um arquivo chamado `.env.local` (copiando as chaves do arquivo `.env.example`).
- Preencha com as credenciais do seu projeto Supabase:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
  SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada
  ```

---

## Checklist para Ativar Assinaturas (Stripe)

1. Crie uma conta em [stripe.com](https://stripe.com) (pode ser em Modo de Testes).
2. Cadastre dois produtos recorrentes no catálogo do Stripe:
   - **Plano Básico:** R$ 79,00/mês.
   - **Plano Pro:** R$ 149,00/mês.
3. Copie as chaves de API do painel da Stripe e configure no seu `.env.local`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Configure o endpoint de webhook no painel do Stripe apontando para `https://seu-dominio.com.br/api/stripe/webhook`.

---

## Checklist para Ativar IA (Claude - Anthropic)

1. Obtenha uma chave de API da [Anthropic Console](https://console.anthropic.com).
2. Configure a chave no `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```
3. O BoxHub passará a chamar o modelo `claude-3-5-sonnet` para processar dados de venda e gerar insights financeiros em vez de usar as regras fixas de fallback!
