const router = require('express').Router();
const s = require('./promotions.service');
const v = require('./promotions.validation');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');

router.use(authenticate, requirePermission('promotions.manage'));
router.get('/', h(async (req, res) => ok(res, await s.list())));
router.post('/', csrfProtection, validate(v.body), h(async (req, res) => ok(res, await s.save(req, null, req.valid.body), null, 201)));
router.put('/:id', csrfProtection, validate(v.update), h(async (req, res) => ok(res, await s.save(req, req.valid.params.id, req.valid.body))));
router.delete('/:id', csrfProtection, validate(v.id), h(async (req, res) => { await s.remove(req, req.valid.params.id); ok(res, null); }));
module.exports = router;
