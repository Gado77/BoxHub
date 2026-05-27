# Central de SuperAdmin e Arquitetura Global SaaS

Este documento reúne todas as modificações de arquitetura, banco de dados e controle de segurança implementadas na **Central de SuperAdmin** (Fase 28) e no fluxo de autenticação do BoxHub.

---

## 1. Central de SuperAdmin (Fase 28)
*   **Objetivo:** Permitir ao dono da plataforma BoxHub gerenciar todas as empresas/firmezas registradas e verificar a integridade física da infraestrutura técnica.
*   **Acesso Restrito:** A aba de navegação e a rota `/dashboard/superadmin` são exclusivas para usuários com `role === 'superadmin'`. Qualquer tentativa de acesso por usuários comuns (`admin` ou `vendedor`) redireciona para a tela de erro "Acesso não autorizado".
*   **Métricas SaaS Consolidadas:**
    *   **Faturamento Global:** Soma das vendas de todas as empresas cadastradas no sistema.
    *   **Vendas Consolidadas:** Quantidade geral de transações de vendas no SaaS.
    *   **Empresas Integradas:** Contagem de organizações ativas na base.
    *   **Usuários Totais:** Quantidade geral de perfis (colaboradores) registrados.
*   **Status de Integridade Técnica:**
    *   **Status Supabase:** Indica se a aplicação está conectada ao banco real do Supabase ou em Modo Sandbox (Mock local).
    *   **Uso de Disco PostgreSQL:** Barra de progresso HSL calculada com base no consumo estimado de dados (média de 18KB por registro cadastrado) para alertar sobre o limite de 500MB do plano gratuito do Supabase.
    *   **Latência de API:** Medição em milissegundos da comunicação com o banco de dados.
    *   **Status de Infraestrutura:** Monitoramento da API do Next.js, workers da API da Claude (Anthropic), webhooks do Stripe e validade do certificado SSL.
*   **Gestão Administrativa de Empresas:**
    *   Listagem completa com ID da empresa, quantidade de colaboradores, total de transações, faturamento individual e plano contratado (Trial/Pro).
    *   **Bloqueio de Contas:** Botão administrativo para suspender/ativar assinaturas de empresas específicas (altera o status da assinatura de `active` para `canceled`).
    *   **Simular Login (Impersonation):** Botão local (suportado em modo Mock) que permite ao SuperAdmin assumir temporariamente a identidade de administrador de qualquer empresa listada para prestar suporte direto aos clientes.

---

## 2. Ajustes de Segurança de Banco (Supabase RLS)
Por rodar do lado do cliente (client-side) utilizando a chave pública (`anon_key`), as políticas de Row Level Security (RLS) do Supabase bloqueavam o SuperAdmin de ler informações de outras empresas (as políticas de tenant comuns filtram as consultas SQL para retornar apenas dados onde `organization_id` é igual ao do usuário logado).

Para contornar isso com segurança, aplicamos as seguintes mudanças no arquivo [supabase/schema.sql](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/supabase/schema.sql):

1.  **Função de Verificação:** Criamos a função no PostgreSQL para validar se o usuário solicitante é um superadmin:
    ```sql
    create or replace function public.is_superadmin()
    returns boolean security definer as $$
    begin
        return exists (
            select 1 from public.profiles 
            where id = auth.uid() and role = 'superadmin'
        );
    end;
    $$ language plpgsql;
    ```
2.  **Novas Políticas RLS:** Registramos regras adicionais para autorizar o bypass de tenant quando `is_superadmin()` retornar verdadeiro:
    *   `public.organizations` (SELECT e UPDATE permitido para superadmins).
    *   `public.profiles` (SELECT permitido para superadmins).
    *   `public.sales` (SELECT permitido para superadmins).
    *   `public.clients` (SELECT permitido para superadmins).

> [!IMPORTANT]
> **Ação Necessária no Supabase:** Lembre-se de executar o arquivo SQL [schema.sql](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/supabase/schema.sql) ou rodar as políticas acima no **SQL Editor** do seu painel do Supabase para atualizar a estrutura de produção.

---

## 3. Fluxo de Autenticação e Login
Realizamos correções cruciais na página de login [src/app/login/page.tsx](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/src/app/login/page.tsx) e no layout global de navegação [src/app/dashboard/layout.tsx](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/src/app/dashboard/layout.tsx):

*   **Detecção de Chaves/Modo:** Exibição de um selo (badge) no rodapé do login que informa se a aplicação está rodando em **"Modo de Demonstração (Local)"** ou **"Banco de Dados Real (Supabase) Ativo"**.
*   **Cadastro Simplificado de SuperAdmin:** Atualizamos a lógica de criação de contas. Se o e-mail cadastrado na aba "Cadastrar Box" contiver a palavra `superadmin` (ex: `superadmin@boxhub.com.br`), a aplicação automaticamente insere a role `superadmin` na tabela `profiles` do Supabase.
*   **Resolução de Sessões Órfãs:** Corrigimos o comportamento do dashboard onde usuários ficavam presos na tela preta/vazia caso a sessão no navegador existisse mas o registro de perfil (`profiles`) tivesse sido excluído ou não criado por erros de banco. Agora, se o perfil retornar nulo, o layout chama a limpeza automática de credenciais (`signOut`) e redireciona para a tela de login.
*   **Alerta de Confirmação de E-mail:** Inserimos instruções de desenvolvimento na tela caso a assinatura de novos usuários falhe por conta da validação de e-mail ativada nas configurações padrão do Supabase (para desenvolvimento fluido, a confirmação de e-mail deve ser desmarcada em *Authentication -> Providers -> Email -> Confirm email* no dashboard do Supabase).
*   **Bypass de Dica no Mobile:** As dicas de configuração técnica só aparecem na tela quando o site é acessado por desenvolvedores em endereços de `localhost` (ou IPs locais). Na versão de produção publicada na Vercel, a interface permanece totalmente limpa e livre de termos técnicos de desenvolvimento.
