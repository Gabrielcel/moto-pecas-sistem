const router = require('express').Router();
const s = require('./orders.service');
const v = require('./orders.validation');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');
const { orderLimiter } = require('../../middlewares/rateLimit');

// Público: o pedido é SALVO antes de o cliente ser enviado ao WhatsApp (regra central do projeto)
router.post('/', orderLimiter, validate(v.create), h(async (req, res) => ok(res, await s.create(req, req.valid.body), null, 201)));

router.get('/', authenticate, requirePermission('orders.view'), validate(v.list), h(async (req, res) => { const r = await s.list(req.valid.query); ok(res, r.rows, r.meta); }));
router.get('/:id', authenticate, requirePermission('orders.view'), validate(v.id), h(async (req, res) => ok(res, await s.getAdmin(req.valid.params.id))));
router.patch('/:id/status', authenticate, csrfProtection, requirePermission('orders.update'), validate(v.status), h(async (req, res) => ok(res, await s.changeStatus(req, req.valid.params.id, req.valid.body))));
router.patch('/:id/delivery', authenticate, csrfProtection, requirePermission('orders.update'), validate(v.delivery), h(async (req, res) => ok(res, await s.updateDelivery(req, req.valid.params.id, req.valid.body))));
router.post('/:id/payments', authenticate, csrfProtection, requirePermission('orders.update'), validate(v.payment), h(async (req, res) => ok(res, await s.addPayment(req, req.valid.params.id, req.valid.body), null, 201)));
module.exports = router;
