const router = require('express').Router();
const { z } = require('zod');
const crud = require('../../utils/simpleCrud');
const s = require('./delivery.service');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { estimateLimiter } = require('../../middlewares/rateLimit');

const addr = z.object({ city: z.string().min(2).max(100), state: z.string().length(2), street: z.string().max(180).nullish(),
  number: z.string().max(20).nullish(), neighborhood: z.string().max(100).nullish(), postal_code: z.string().max(10).nullish(),
  latitude: z.number().nullish(), longitude: z.number().nullish() }).passthrough();
router.post('/estimate', estimateLimiter, validate({ body: addr }), h(async (req, res) => ok(res, await s.estimate(req.valid.body))));

router.use('/regions', crud({
  table: 'delivery_regions', entity: 'regiao_entrega', permission: 'settings.manage', cols: ['city', 'state', 'status'], orderBy: 't.city',
  usedBy: ['SELECT 1 FROM order_deliveries WHERE delivery_region_id=$1 LIMIT 1'],
  schema: z.object({ city: z.string().min(2).max(100), state: z.string().length(2).transform((x) => x.toUpperCase()), status: z.boolean().default(true) }),
}));
module.exports = router;
