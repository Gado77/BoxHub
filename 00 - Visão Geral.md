# BoxHub — Visão Geral do Projeto

**BoxHub** é um sistema de gestão de vendas e CRM (SaaS) sob medida para comerciantes de frutas do **CEAGESP** (São Paulo). 

A maioria dos comerciantes no CEAGESP opera de forma informal (caderno, planilhas simples ou memória). O BoxHub resolve as dores do dia a dia desses comerciantes através de uma interface extremamente rápida, limpa e adaptada para dispositivos móveis e desktops.

---

## Dores do Cliente CEAGESP
- **Descontrole de Fiado:** Dificuldade em saber o saldo devedor atual de cada cliente e quando cobrar.
- **Inatividade de Clientes:** Não sabe quem são os melhores clientes e quando eles pararam de comprar.
- **Falta de Organização:** Registros perdidos ou dispersos de vendas e amortizações.
- **Dificuldade Operacional:** Sistemas complexos demais que exigem computadores ou treinamento demorado.

---

## Funcionalidades Principais do MVP

- **Autenticação & Multi-inquilinato (Multi-tenant):** Cada comerciante (Box) cria sua conta de firma e gerencia sua equipe (administradores e vendedores).
- **Venda Rápida (Checkout):** 
  - Seleção de cliente ou Venda Direta rápida.
  - Cadastro rápido de cliente "on-the-fly" diretamente no modal de venda.
  - Seleção dinâmica de frutas e variantes (ex: Maracujá Da Bahia / Do Sul).
  - Três métodos de pagamento: Dinheiro, Pix ou **Fiado**.
- **Fichas de Fiado (CRM):**
  - Definição de limites de crédito (ficha de fiado).
  - Alerta visual instantâneo se a venda excede o limite disponível do cliente.
  - Registro fácil de amortização (pagamento parcial ou total de fiado).
  - Histórico detalhado de faturamento e status de pagamento por cliente.
- **Estoque Flexível:** Toggle nas configurações para ativar/desativar o controle físico de caixas.
- **Análise Inteligente por IA:** Insights diários automáticos integrados com o Claude (Anthropic) para auditar clientes inativos e fiados em atraso.

---

## Próximos Passos
- [ ] Testar as páginas e fluxos locais no modo de simulação (Mock).
- [ ] Criar conta no Supabase e rodar migrações SQL.
- [ ] Configurar chaves do Stripe e Claude no arquivo de ambiente `.env.local`.
- [ ] Deploy na Vercel para testes com clientes reais.
