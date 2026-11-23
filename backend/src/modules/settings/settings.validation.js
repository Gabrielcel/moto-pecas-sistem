const { z } = require('zod');
const num = z.coerce.number().min(0);
const schema = z.object({
  store_name: z.string().min(2).max(120),
  store_phone: z.string().regex(/^\d{10,15}$/, 'Informe só dígitos com DDI/DDD (ex.: 5588999999999)'),
  store_email: z.string().email().max(180),
  store_address: z.string().max(250),
  store_latitude: z.coerce.number().min(-90).max(90),
  store_longitude: z.coerce.number().min(-180).max(180),
  contact_info: z.string().max(500),
  business_days: z.array(z.number().int().min(0).max(6)).min(1),
  business_hours: z.object({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) }),
  reservation_minutes: z.coerce.number().int().min(5).max(1440),
  freight_base: num, freight_per_km: num, freight_min: num,
  accept_pickup: z.boolean(), accept_delivery: z.boolean(), reviews_require_approval: z.boolean(),
  payment_methods: z.array(z.enum(['pix', 'dinheiro', 'cartao_credito', 'cartao_debito'])).min(1),
}).partial();
module.exports = { update: { body: schema } };
