const router = require('express').Router();
const { z } = require('zod');
const s = require('./reviews.service');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');
const { trackingLimiter } = require('../../middlewares/rateLimit');

const create = z.object({ code: z.string().regex(/^\d{1,12}$/), order_item_id: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional().nullable() });
router.post('/', trackingLimiter, validate({ body: create }), h(async (req, res) =>
  ok(res, await s.create(req.valid.body.code, req.get('x-tracking-token'), req.valid.body), null, 201)));

router.get('/', authenticate, requirePermission('reviews.moderate'), h(async (req, res) => { const r = await s.listAdmin(req.query); ok(res, r.rows, r.meta); }));
router.patch('/:id/status', authenticate, csrfProtection, requirePermission('reviews.moderate'),
  validate({ params: z.object({ id: z.coerce.number().int().positive() }), body: z.object({ status: z.enum(['publicada', 'oculta', 'pendente']) }) }),
  h(async (req, res) => ok(res, await s.setStatus(req, req.valid.params.id, req.valid.body.status))));
module.exports = router;
