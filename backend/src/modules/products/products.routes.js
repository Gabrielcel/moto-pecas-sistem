const router = require('express').Router();
const multer = require('multer');
const c = require('./products.controller');
const v = require('./products.validation');
const { asyncHandler: h } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, optionalAuth, requirePermission, csrfProtection } = require('../../middlewares/auth');
const reviews = require('../reviews/reviews.service');
const { ok } = require('../../utils/helpers');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });
const manage = [authenticate, csrfProtection, requirePermission('products.manage')];

router.get('/', optionalAuth, validate(v.list), h(c.list));
router.get('/:id', optionalAuth, validate(v.id), h(c.get));
router.get('/:id/related', validate(v.id), h(c.related));
router.get('/:id/reviews', validate(v.id), h(async (req, res) => ok(res, await reviews.listForProduct(req.valid.params.id))));

router.post('/', ...manage, validate(v.create), h(c.create));
router.put('/:id', ...manage, validate(v.update), h(c.update));
router.delete('/:id', ...manage, validate(v.id), h(c.remove));
router.put('/:id/compatibilities', ...manage, validate(v.compat), h(c.setCompat));
router.post('/:id/images', ...manage, validate(v.id), upload.array('images', 8), h(c.addImages));
router.patch('/:id/images/:imageId', ...manage, validate(v.imagePatch), h(c.patchImage));
router.delete('/:id/images/:imageId', ...manage, validate(v.imageParams), h(c.removeImage));
module.exports = router;
