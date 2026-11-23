const { z } = require('zod');
const body = z.object({
  name: z.string().min(2).max(150), description: z.string().max(500).nullish(),
  discount_type: z.enum(['percentual', 'fixo']), discount_value: z.coerce.number().positive(),
  start_at: z.coerce.date(), end_at: z.coerce.date(), status: z.boolean().default(true),
  product_ids: z.array(z.number().int().positive()).min(1, 'Selecione ao menos um produto'),
}).refine((d) => d.end_at > d.start_at, { message: 'O término deve ser posterior ao início', path: ['end_at'] })
  .refine((d) => d.discount_type !== 'percentual' || d.discount_value < 100, { message: 'Percentual deve ser menor que 100', path: ['discount_value'] });
const id = z.object({ id: z.coerce.number().int().positive() });
module.exports = { body: { body }, id: { params: id }, update: { params: id, body } };
