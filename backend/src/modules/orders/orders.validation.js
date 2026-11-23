const { z } = require('zod');
const { digits } = require('../../utils/helpers');
const id = z.object({ id: z.coerce.number().int().positive() });
const text = (n) => z.string().trim().max(n);
const address = z.object({
  postal_code: text(10).optional().nullable(), street: text(180).min(2, 'Informe a rua'), number: text(20).optional().nullable(),
  complement: text(120).optional().nullable(), neighborhood: text(100).optional().nullable(), city: text(100).min(2, 'Informe a cidade'),
  state: z.string().trim().length(2, 'UF com 2 letras').transform((s) => s.toUpperCase()), reference: text(300).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(),
});
const create = z.object({
  customer: z.object({
    name: text(150).min(3, 'Informe o nome completo'),
    phone: z.string().refine((p) => { const d = digits(p); return d.length >= 10 && d.length <= 13; }, 'Telefone inválido (com DDD)'),
    email: z.string().email().max(180).optional().nullable().or(z.literal('').transform(() => null)),
    cpf: z.string().max(14).optional().nullable(),
  }),
  receiving_method: z.enum(['entrega', 'retirada']),
  address: address.optional().nullable(),
  items: z.array(z.object({ product_id: z.number().int().positive(), quantity: z.number().int().min(1).max(999) })).min(1, 'O carrinho está vazio').max(50),
  whatsapp_consent: z.boolean().default(false),
  payment_method_preferred: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito']).optional().nullable(),
  notes: text(500).optional().nullable(),
}).refine((d) => d.receiving_method !== 'entrega' || !!d.address, { message: 'Informe o endereço de entrega', path: ['address'] });

const list = z.object({ page: z.any(), limit: z.any(), status: z.string().optional(), q: z.string().max(100).optional(),
  receiving_method: z.enum(['entrega', 'retirada']).optional(), from: z.string().optional(), to: z.string().optional(), awaiting: z.enum(['1']).optional() });
const status = z.object({
  status: z.enum(['pedido_confirmado', 'preparando_pedido', 'saiu_para_entrega', 'pedido_entregue', 'pedido_cancelado']),
  notes: text(500).optional(),
  delivery_fee: z.coerce.number().min(0).max(100000).optional(),
  estimated_delivery_at: z.coerce.date().optional().nullable(),
  carrier: z.enum(['proprio', 'uber', 'outro']).optional(),
  payment: z.object({ payment_method: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito']), transaction_reference: text(180).optional() }).optional(),
});
const delivery = z.object({ delivery_fee: z.coerce.number().min(0).max(100000).optional(), estimated_delivery_at: z.coerce.date().optional().nullable(), carrier: z.enum(['proprio', 'uber', 'outro']).optional() });
const payment = z.object({ payment_method: z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito']), amount: z.coerce.number().min(0).optional(),
  status: z.enum(['pendente', 'pago']).default('pago'), transaction_reference: text(180).optional() });
module.exports = { create: { body: create }, list: { query: list }, id: { params: id }, status: { params: id, body: status },
  delivery: { params: id, body: delivery }, payment: { params: id, body: payment } };
