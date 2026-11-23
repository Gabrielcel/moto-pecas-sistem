const router = require('express').Router();
const { z } = require('zod');
const s = require('./notifications.service');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');
const { audit } = require('../../services/audit.service');

router.use(authenticate);
router.get('/', requirePermission('orders.view'), h(async (req, res) => ok(res, await s.list(req.query.order_id ? Number(req.query.order_id) : null))));
router.post('/manual', csrfProtection, requirePermission('orders.update'),
  validate({ body: z.object({ order_id: z.number().int().positive(), message: z.string().min(2).max(1000) }) }),
  h(async (req, res) => { const r = await s.sendManual(req, req.valid.body.order_id, req.valid.body.message);
    await audit(req, 'mensagem_manual_whatsapp', 'orders', req.valid.body.order_id); ok(res, r, null, 201); }));
router.post('/:id/retry', csrfProtection, requirePermission('orders.update'), validate({ params: z.object({ id: z.coerce.number().int().positive() }) }),
  h(async (req, res) => ok(res, { status: await s.retry(req.valid.params.id) })));
module.exports = router;
