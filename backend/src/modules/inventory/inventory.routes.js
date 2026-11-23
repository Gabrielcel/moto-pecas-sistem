const router = require('express').Router();
const { z } = require('zod');
const s = require('./inventory.service');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');

const pid = z.object({ productId: z.coerce.number().int().positive() });
const mov = z.object({
  product_id: z.number().int().positive(),
  movement_type: z.enum(['entrada', 'saida', 'ajuste_positivo', 'ajuste_negativo']),
  quantity: z.number().int().positive().max(100000),
  reason: z.string().max(300).optional(),
}).refine((d) => !d.movement_type.startsWith('ajuste') || (d.reason && d.reason.trim().length >= 3), { message: 'Informe o motivo do ajuste', path: ['reason'] });

router.use(authenticate, requirePermission('inventory.manage'));
router.get('/', h(async (req, res) => { const r = await s.list(req.query); ok(res, r.rows, r.meta); }));
router.get('/alerts', h(async (req, res) => ok(res, await s.lowStock(50))));
router.get('/movements', h(async (req, res) => { const r = await s.movements(req.query); ok(res, r.rows, r.meta); }));
router.post('/movements', csrfProtection, validate({ body: mov }), h(async (req, res) => ok(res, await s.manualMovement(req, req.valid.body), null, 201)));
router.put('/:productId/minimum', csrfProtection, validate({ params: pid, body: z.object({ minimum_quantity: z.number().int().min(0) }) }),
  h(async (req, res) => ok(res, await s.setMinimum(req, req.valid.params.productId, req.valid.body.minimum_quantity))));
module.exports = router;
