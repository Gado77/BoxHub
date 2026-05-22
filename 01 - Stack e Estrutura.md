# Stack e Estrutura do Projeto

O BoxHub foi estruturado sob o conceito de **Zero Configuração Inicial** para permitir testes imediatos, utilizando tecnologias modernas e eficientes.

---

## Tecnologias Utilizadas (Stack)

- **Frontend/Backend:** Next.js 15+ (App Router, React 19)
- **Linguagem:** TypeScript
- **Estilização:** Vanilla CSS via **CSS Modules** (`*.module.css`) para garantir performance máxima, modularidade e controle estético total, sem dependência de Tailwind CSS.
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL + RLS + JWT Auth)
- **Pagamentos & SaaS:** Stripe API (Assinaturas e Checkout)
- **Inteligência Artificial:** Claude (Anthropic AI SDK)
- **Pacotes de Ícones:** `lucide-react`

---

## Estrutura de Arquivos do Projeto

Abaixo está o layout das principais pastas do projeto no repositório local:

```text
boxhub/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/insights/route.ts      # Integração com Claude
│   │   │   └── stripe/
│   │   │       ├── checkout/route.ts     # Checkout de assinaturas
│   │   │       └── webhook/route.ts      # Webhook de ativação SaaS
│   │   ├── dashboard/
│   │   │   ├── clientes/                 # CRM e amortização
│   │   │   ├── configuracoes/            # Estoque, equipe e Stripe
│   │   │   ├── produtos/                 # Frutas e variantes
│   │   │   ├── layout.tsx                # Sidebar e navegação responsiva
│   │   │   └── page.tsx                  # Métricas e Insights
│   │   ├── login/                        # Login e cadastro do Box
│   │   ├── globals.css                   # Design System (variáveis CSS)
│   │   ├── layout.tsx                    # Metadados e fonte Inter/Poppins
│   │   └── page.tsx                      # Redirecionador para login
│   ├── components/
│   │   ├── NewSaleModal.tsx              # Modal interativo de checkout
│   │   └── NewSaleModal.module.css
│   └── lib/
│       └── supabase.ts                   # Conexão híbrida DB/Mock
├── supabase/
│   └── schema.sql                        # Script SQL de tabelas e RLS
├── .env.example                          # Configuração de chaves
└── package.json                          # Scripts e dependências
```

---

## Padrão CSS e Design System

Os estilos globais e variáveis de design estão centralizados em [src/app/globals.css](file:///c:/Users/itach/Documents/Segundo Cérebro/Projetos/boxhub/src/app/globals.css).
- **Tema:** Escuro premium (Deep Space) com detalhes em verde esmeralda (`#1D9E75`) representando as frutas/CEAGESP.
- **Estilos Globais:** Componentes comuns como `.btn-primary`, `.btn-secondary`, `.form-control`, `.badge` e `.glass` (efeito de vidro com blur) estão declarados globalmente para reutilização.
