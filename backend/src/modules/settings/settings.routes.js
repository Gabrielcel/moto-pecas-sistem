const router = require('express').Router();
const { asyncHandler, ok } = require('../../utils/helpers');
const { authenticate, requirePermission, csrfProtection } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const service = require('./settings.service');
const v = require('./settings.validation');

router.get('/public', asyncHandler(async (req, res) => ok(res, await service.getPublic())));
router.get('/', authenticate, requirePermission('settings.manage'), asyncHandler(async (req, res) => ok(res, (await service.getTyped()).typed)));
router.put('/', authenticate, csrfProtection, requirePermission('settings.manage'), validate(v.update),
  asyncHandler(async (req, res) => ok(res, await service.update(req, req.valid.body))));
module.exports = router;
