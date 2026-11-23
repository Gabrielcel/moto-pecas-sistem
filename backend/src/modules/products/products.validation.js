const { z } = require('zod');
const id = z.object({ id: z.coerce.number().int().positive() });
const optNum = z.coerce.number().optional();
const list = z.object({
  q: z.string().max(100).optional(), category_id: z.coerce.number().optional(), brand_id: z.coerce.number().optional(),
  moto_brand_id: z.coerce.number().optional(), moto_model_id: z.coerce.number().optional(),
  min_price: optNum, max_price: optNum, in_stock: z.enum(['1', '0']).optional(), promo: z.enum(['1', '0']).optional(),
  featured: z.enum(['1', '0']).optional(), status: z.enum(['ativo', 'inativo']).optional(), include_inactive: z.enum(['1', '0']).optional(),
  sort: z.enum(['recentes', 'preco_asc', 'preco_desc', 'nome', 'vendidos', 'destaque']).optional(),
  page: z.any(), limit: z.any(),
});
const compat = z.array(z.object({ motorcycle_model_id: z.number().int().positive(), notes: z.string().max(300).nullish() }));
const base = z.object({
  name: z.string().min(2).max(180), reference: z.string().max(100).nullish(), description: z.string().max(5000).nullish(),
  category_id: z.number().int().positive().nullish(), brand_id: z.number().int().positive().nullish(),
  sale_price: z.coerce.number().min(0).max(1000000), purchase_cost: z.coerce.number().min(0).max(1000000).default(0),
  status: z.enum(['ativo', 'inativo']).default('ativo'), is_featured: z.boolean().default(false),
  minimum_quantity: z.number().int().min(0).default(0), initial_quantity: z.number().int().min(0).default(0),
  compatibilities: compat.optional(),
}).refine((d) => d.status !== 'ativo' || d.sale_price > 0, { message: 'Produto ativo precisa de preço de venda maior que zero', path: ['sale_price'] });
module.exports = {
  id: { params: id }, list: { query: list }, create: { body: base }, update: { params: id, body: base },
  compat: { params: id, body: z.object({ compatibilities: compat }) },
  imageParams: { params: z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() }) },
  imagePatch: { params: z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() }),
    body: z.object({ is_primary: z.boolean().optional(), display_order: z.number().int().min(0).optional() }) },
};
