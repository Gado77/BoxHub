import { z } from 'zod';

// Schema para convidar membros na equipe (API: /api/team/add)
export const teamInviteSchema = z.object({
  email: z
    .string()
    .min(1, 'O e-mail é obrigatório.')
    .email('E-mail em formato inválido.')
    .max(255, 'O e-mail deve ter no máximo 255 caracteres.'),
  name: z
    .string()
    .min(1, 'O nome é obrigatório.')
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  role: z.enum(['admin', 'vendedor', 'superadmin'], {
    message: 'Cargo/função do membro inválida.',
  }),
  organization_id: z
    .string()
    .min(1, 'O ID da organização é obrigatório.')
    .uuid('ID da organização inválido (deve ser UUID).'),
});

// Schema para inicializar sessão de checkout (API: /api/stripe/checkout)
export const checkoutSchema = z.object({
  priceId: z
    .string()
    .min(1, 'O priceId é obrigatório.')
    .min(5, 'Price ID muito curto.')
    .max(100, 'Price ID muito longo.'),
});

// Schema para validação de clientes (Frontend / RLS)
export const clientSchema = z.object({
  name: z
    .string()
    .min(1, 'O nome do cliente é obrigatório.')
    .min(2, 'O nome do cliente deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome do cliente deve ter no máximo 100 caracteres.'),
  type: z.enum(['quitanda', 'restaurante', 'mercado', 'outro'], {
    message: 'Tipo de cliente inválido.',
  }),
  contact: z
    .string()
    .max(50, 'O contato deve ter no máximo 50 caracteres.')
    .optional()
    .nullable(),
  fiado_limit: z
    .number()
    .min(0, 'O limite de fiado deve ser maior ou igual a zero.')
    .max(1000000, 'O limite de fiado máximo é de R$ 1.000.000,00.'),
});

// Schema para validação de produtos (Frontend / RLS)
export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'O nome do produto é obrigatório.')
    .min(2, 'O nome do produto deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome do produto deve ter no máximo 100 caracteres.'),
  description: z
    .string()
    .max(255, 'A descrição deve ter no máximo 255 caracteres.')
    .optional()
    .nullable(),
  category: z
    .string()
    .max(100, 'A categoria deve ter no máximo 100 caracteres.')
    .optional()
    .nullable(),
  type: z.enum(['fruta', 'legume'], {
    message: 'Tipo de produto deve ser fruta ou legume.',
  }),
  stock_quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro.')
    .min(0, 'A quantidade de estoque não pode ser negativa.'),
});

// Schema para item de venda
export const saleItemSchema = z.object({
  productId: z.string().uuid('ID do produto inválido.'),
  variantId: z.string().uuid('ID da variante inválido.').nullable().optional(),
  quantity: z
    .number()
    .int('A quantidade vendida deve ser um número inteiro.')
    .positive('A quantidade vendida deve ser maior que zero.'),
  pricePerBox: z
    .number()
    .positive('O preço por caixa deve ser maior que zero.'),
});

// Schema para registrar venda (Frontend / RLS)
export const saleSchema = z.object({
  client_id: z.string().uuid('ID do cliente inválido.').nullable().optional(),
  payment_method: z.enum(['dinheiro', 'pix', 'fiado'], {
    message: 'Método de pagamento inválido.',
  }),
  items: z
    .array(saleItemSchema)
    .min(1, 'A venda precisa conter pelo menos um item.'),
});
