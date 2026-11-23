const router = require('express').Router();
const { query } = require('../../database/pool');
const products = require('../products/products.service');
const { asyncHandler: h, ok } = require('../../utils/helpers');

// RF001/RF008–RF010: destaques (escolhidos pelo admin), novidades, mais vendidos e promoções
router.get('/home', h(async (req, res) => {
  const [featured, newest, bestsellers, promos] = await Promise.all([
    products.list({ featured: '1', sort: 'destaque', limit: 8 }, false),
    products.list({ sort: 'recentes', limit: 8 }, false),
    products.list({ sort: 'vendidos', limit: 8 }, false),
    products.list({ promo: '1', sort: 'recentes', limit: 8 }, false),
  ]);
  const categories = (await query(`SELECT c.id, c.name, c.description, c.parent_id,
      (SELECT count(*)::int FROM products p WHERE p.status='ativo' AND (p.category_id=c.id OR p.category_id IN (SELECT id FROM categories WHERE parent_id=c.id))) AS products_count
      FROM categories c WHERE c.status ORDER BY c.name`)).rows;
  ok(res, { featured: featured.rows, newest: newest.rows, bestsellers: bestsellers.rows.filter((p) => p.sold > 0), promotions: promos.rows, categories });
}));
module.exports = router;
