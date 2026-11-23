const router = require('express').Router();
const { authenticate, csrfProtection } = require('../middlewares/auth');
const { query } = require('../database/pool');

router.get('/health', async (req, res) => {
  try { await query('SELECT 1'); res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }); }
  catch (e) { res.status(503).json({ success: false, error: { code: 'db_down', message: 'Banco indisponível' } }); }
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/settings', require('../modules/settings/settings.routes'));
router.use('/public', require('../modules/public/public.routes'));
router.use('/products', require('../modules/products/products.routes'));
router.use('/categories', require('../modules/categories/categories.routes'));
router.use('/brands', require('../modules/brands/brands.routes'));
router.use('/motorcycles', require('../modules/motorcycles/motorcycles.routes'));
router.use('/inventory', require('../modules/inventory/inventory.routes'));
router.use('/promotions', require('../modules/promotions/promotions.routes'));
router.use('/orders', require('../modules/orders/orders.routes'));
router.use('/tracking', require('../modules/orders/tracking.routes'));
router.use('/delivery', require('../modules/delivery/delivery.routes'));
router.use('/customers', require('../modules/customers/customers.routes'));
router.use('/notifications', require('../modules/notifications/notifications.routes'));
router.use('/reviews', require('../modules/reviews/reviews.routes'));
router.use('/reports', require('../modules/reports/reports.routes'));
router.use('/audit', require('../modules/audit/audit.routes'));
router.use('/', require('../modules/users/users.routes'));      // /users, /roles, /permissions (somente administradores)
module.exports = router;
