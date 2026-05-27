# Páginas e Componentes Frontend

O frontend do BoxHub foi projetado para carregar instantaneamente, com visual moderno e interfaces responsivas para celulares (já que o comerciante opera no meio da feira do CEAGESP).

---

## Páginas e Rotas Implementadas

### 1. `/login` (Autenticação e Onboarding)
- Alternância fluida entre **Login de Usuário** e **Cadastro de Novo Box**.
- Permite o provisionamento automático de uma nova firma no banco de dados ou no repositório local simulado.

### 2. `/dashboard` (Painel Executivo)
- **Cards de Status (Refatorados):** Grid responsiva de 4 colunas com alinhamento pixel-perfect, ícones centralizados em containers translúcidos de tamanho fixo com bordas sutis e cores correspondentes (Verde para Faturamento, Laranja/Vermelho para Fiado, Dourado para Clientes, Azul para Vendas). Layout flexbox horizontal compacto, com micro-interações de elevação no hover (`translateY(-2px)`) e cantos arredondados.
- **Tabela de Vendas Recentes:** Listagem cronológica das últimas vendas com indicação de método de pagamento (PIX, Dinheiro, Fiado).
- **Análise Claude IA:** Caixa de insights preditivos de cobrança e vendas.
- **Ações Rápidas:** Acesso direto para disparar o registro de nova venda.

### 3. `/dashboard/clientes` (Central de Gestão de Clientes e Fiado)
- **Layout de Duas Linhas (Idêntico à Referência Aprovada):**
  - **Primeira Linha (Match Height):** Dividida em Lista de Clientes (esquerda, `320px`) e o Painel Principal de Detalhes do Cliente (direita, `1fr`). Ambas as caixas possuem **alturas idênticas e niveladas** (`align-items: stretch` na linha principal), esticando a aba de diretório de clientes até o limite do rodapé para eliminar qualquer espaço em branco. A lista interna de clientes é flexível (`flex: 1`) e consome todo o espaço restante com rolagem interna elegante. O container de dados de cada item do diretório possui proteção contra overflow (`min-width: 0` nos sub-containers e `overflow-x: hidden`), truncando nomes longos com reticências automaticamente e eliminando qualquer bug de rolagem horizontal.
  - **Segunda Linha (Lado a Lado):** Grid inferior contendo **3 cards horizontais dispostos lado a lado** no desktop (e empilhados verticalmente em mobile):
    1. **Perfil de Faturamento:** Score de Crédito, Ticket Médio, Última Compra, Frequência, Total no Mês e Mini Gráfico Sparkline SVG de tendência dos últimos 30 dias.
    2. **Insights de Crédito (IA):** Mini-cards de insights empilhados verticalmente com bordas laterais coloridas (verde, amarelo, azul) e botão de ação superior.
    3. **Observações Internas:** Bloco de notas com textarea confortável (`140px`), botão verde "Salvar Nota" (usando a cor `var(--success)`) e indicativos de salvamento persistido.
- **Gerenciamento Unificado de Registros:** Integração de modais popup limpos e modernos para "Novo Cliente" e "Editar Cliente" que atualizam o estado instantaneamente sem recarregar a tela.

### 4. `/dashboard/produtos` (Catálogo de Frutas e Variantes)
- **Visualização de Estoques:** Se o estoque estiver ativo, mostra o saldo físico de caixas.
- **Variantes de Fruta:** Adição rápida de variações (ex: "Da Bahia", "Importado").
- **Ajuste de Estoque:** Atualização de saldo de caixas por produto ou variante individual.

### 5. `/dashboard/configuracoes` (Definições de Box e Assinatura)
- **Chave de Estoque:** Toggle para ativar ou desativar o controle físico de inventário.
- **Gestão de Equipe:** Listagem de vendedores com permissões controladas.
- **Planos SaaS (Stripe):** Interface para alteração de plano entre Básico (R$ 79) e Pro (R$ 149) com simulação local.

---

## Componente Destacado: `NewSaleModal`
Localização: [src/components/NewSaleModal.tsx](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/src/components/NewSaleModal.tsx)

O modal de vendas é o coração do sistema. Ele permite:
1. **Cadastro de Cliente On-The-Fly:** Se o cliente não existir, o vendedor clica no botão "+" ao lado do campo de cliente. Abre-se uma gaveta para inserir Nome, Telefone e Limite. O cliente é cadastrado e selecionado no checkout sem perder o carrinho atual!
2. **Seleção Inteligente de Variantes:** O dropdown de variante se atualiza de acordo com o produto. Se a fruta não possuir variantes cadastradas, o campo é desabilitado e omitido no carrinho.
3. **Auditoria de Fiado em Tempo Real:** Se a forma de pagamento selecionada for "Fiado", o modal busca o limite restante da ficha do cliente e compara com o valor total da venda atual. Se ultrapassar, o botão de confirmação é bloqueado e uma mensagem vermelha de alerta é exibida.
