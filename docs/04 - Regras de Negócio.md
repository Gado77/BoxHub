# Diretrizes e Regras de Negócio

O BoxHub segue regras de negócio específicas para o mercado do CEAGESP, simplificando os processos e evitando atritos no dia a dia.

---

## 1. Funcionamento do Fiado (Venda a Prazo)

- **Identificação Obrigatória:** Vendas normais (PIX/Dinheiro) podem ser registradas como "Venda Direta" (sem cliente cadastrado). Vendas na modalidade "Fiado" exigem obrigatoriamente a seleção de um cliente.
- **Limite de Ficha:** Todo cliente possui um limite de crédito configurado (ex: R$ 1.500,00). 
- **Verificação de Limite:** 
  $$\text{Limite Disponível} = \text{Limite Total} - \text{Fiado em Aberto}$$
  Se $\text{Total da Venda Atual} > \text{Limite Disponível}$, o sistema exibe um bloqueio visual e impede a inserção da venda fiada.
- **Amortização:** Clientes podem realizar pagamentos parciais de suas pendências a qualquer momento na página do cliente. A amortização abate diretamente o saldo devedor mais antigo, liberando limite na hora.

---

## 2. Controle de Estoque Flexível (Opcional)

Nas configurações do Box, o administrador pode ligar ou desligar o controle de estoque físico.
- **Estoque Desativado (Padrão):** O faturamento é o foco. Vendedores podem vender qualquer quantidade de caixas de frutas a qualquer preço sem validação de saldos em estoque. O estoque físico é omitido nas telas de cadastro.
- **Estoque Ativado:** O estoque inicial das frutas e variantes deve ser inserido no cadastro. Cada venda confirmada debita fisicamente a quantidade de caixas vendidas do saldo da fruta ou variante correspondente.

---

## 3. Variantes de Fruta Opcionais

Muitas frutas são comercializadas sob variantes distintas que impactam no preço de venda e na preferência do cliente (ex: Manga Palmer vs Manga Tommy, Maracujá Da Bahia vs Maracujá Do Sul).
- **Sem Variante:** Se o produto for cadastrado sem variantes, o carrinho assume a fruta padrão e calcula o preço diretamente.
- **Com Variante:** Se a fruta possuir variantes cadastradas, o modal de nova venda exige a seleção de qual variante está sendo vendida para garantir o rastreio correto de estoque e precificação.

---

## 4. Geração de Insights de IA (Claude)

O sistema de insights audita o banco de dados e sugere ações de cobrança e marketing:
- **Alerta de Inatividade (Warning):** Clientes com tempo decorrido desde a última compra maior do que 10 dias recebem sugestão de contato.
- **Risco de Inadimplência (Danger):** Clientes com fiado em aberto significativo e antigo são sinalizados com recomendação de cobrança antes de liberar novas vendas.
- **Destaque de Crescimento (Success):** Identificação de clientes fiéis e taxas de crescimento para incentivar o relacionamento.
