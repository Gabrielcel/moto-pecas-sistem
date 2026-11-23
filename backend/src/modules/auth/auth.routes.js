const router = require('express').Router();
const c = require('./auth.controller');
const v = require('./auth.validation');
const { asyncHandler: h } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, csrfProtection } = require('../../middlewares/auth');
const { loginLimiter, passwordLimiter } = require('../../middlewares/rateLimit');

router.post('/login', loginLimiter, validate(v.login), h(c.login));
router.post('/logout', h(c.logout));
router.get('/me', authenticate, h(c.me));
router.post('/change-password', authenticate, csrfProtection, validate(v.changePassword), h(c.changePassword));
router.post('/forgot-password', passwordLimiter, validate(v.forgot), h(c.forgot));
router.post('/reset-password', passwordLimiter, validate(v.reset), h(c.reset));
module.exports = router;
