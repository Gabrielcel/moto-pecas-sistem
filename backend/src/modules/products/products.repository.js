const { query } = require('../../database/pool');
const { PROMO_JOIN } = require('../promotions/pricing');
const { likeEscape } = require('../../utils/helpers');

const JOINS = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN inventory i ON i.product_id = p.id
  ${PROMO_JOIN}
  LEFT JOIN LATERAL (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, display_order, id LIMIT 1) img ON TRUE
  LEFT JOIN LATERAL (SELECT round(avg(rating)::numeric, 1)::float AS avg_rating, count(*)::int AS reviews_count
                       FROM reviews WHERE product_id = p.id AND status = 'publicada') rv ON TRUE
  LEFT JOIN LATERAL (SELECT COALESCE(sum(oi.quantity), 0)::int AS sold FROM order_items oi JOIN orders o ON o.id = oi.order_id
                      WHERE oi.product_id = p.id AND o.status <> 'pedido_cancelado') sl ON TRUE`;

const columns = (admin) => `p.id, p.name, p.reference, p.description, p.sale_price, p.status, p.is_featured, p.created_at,
  p.category_id, c.name AS category_name, p.brand_id, b.name AS brand_name,
  promo.promo_price, promo.promo_name, COALESCE(promo.promo_price, p.sale_price) AS final_price,
  GREATEST(COALESCE(i.quantity,0) - COALESCE(i.reserved_quantity,0), 0) AS available_quantity,
  img.image_url, rv.avg_rating, rv.reviews_count, sl.sold
  ${admin ? ', p.purchase_cost, i.quantity, i.reserved_quantity, i.minimum_quantity' : ''}`;

const SORTS = {
  recentes: 'p.created_at DESC, p.id DESC', preco_asc: 'final_price ASC', preco_desc: 'final_price DESC',
  nome: 'p.name ASC', vendidos: 'sl.sold DESC, p.name', destaque: 'p.is_featured DESC, p.created_at DESC',
};

function buildFilters(f, admin) {
  const w = []; const a = [];
  const add = (sql, val) => { a.push(val); w.push(sql.replace(/\?/g, `$${a.length}`)); };
  if (!(admin && (f.include_inactive === '1'))) w.push("p.status = 'ativo'");
  else if (f.status) add('p.status = ?', f.status);

  // Cada palavra da busca deve casar com nome, referência, fabricante, categoria ou modelo/marca de moto compatível
  for (const tok of String(f.q || '').split(/\s+/).filter(Boolean).slice(0, 6)) {
    a.push(`%${likeEscape(tok)}%`); const n = `$${a.length}`;
    w.push(`(unaccent(p.name) ILIKE unaccent(${n}) OR unaccent(COALESCE(p.reference,'')) ILIKE unaccent(${n})
      OR unaccent(COALESCE(b.name,'')) ILIKE unaccent(${n}) OR unaccent(COALESCE(c.name,'')) ILIKE unaccent(${n})
      OR EXISTS (SELECT 1 FROM product_compatibilities pc JOIN motorcycle_models mm ON mm.id = pc.motorcycle_model_id
                  JOIN motorcycle_brands mb ON mb.id = mm.brand_id
                 WHERE pc.product_id = p.id AND unaccent(mb.name || ' ' || mm.name) ILIKE unaccent(${n})))`);
  }
  if (f.category_id) add('p.category_id IN (SELECT id FROM categories WHERE id = ? OR parent_id = ?)', f.category_id);
  if (f.brand_id) add('p.brand_id = ?', f.brand_id);
  if (f.moto_model_id) add('EXISTS (SELECT 1 FROM product_compatibilities pc WHERE pc.product_id = p.id AND pc.motorcycle_model_id = ?)', f.moto_model_id);
  if (f.moto_brand_id) add(`EXISTS (SELECT 1 FROM product_compatibilities pc JOIN motorcycle_models mm ON mm.id = pc.motorcycle_model_id
                                     WHERE pc.product_id = p.id AND mm.brand_id = ?)`, f.moto_brand_id);
  if (f.min_price !== undefined) add('COALESCE(promo.promo_price, p.sale_price) >= ?', f.min_price);
  if (f.max_price !== undefined) add('COALESCE(promo.promo_price, p.sale_price) <= ?', f.max_price);
  if (f.in_stock === '1') w.push('COALESCE(i.quantity,0) - COALESCE(i.reserved_quantity,0) > 0');
  if (f.promo === '1') w.push('promo.promo_id IS NOT NULL');
  if (f.featured === '1') w.push('p.is_featured');
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: a };
}

async function search(f, p, admin) {
  const { where, params } = buildFilters(f, admin);
  const total = (await query(`SELECT count(*)::int AS n ${JOINS} ${where}`, params)).rows[0].n;
  const rows = (await query(`SELECT ${columns(admin)} ${JOINS} ${where} ORDER BY ${SORTS[f.sort] || SORTS.recentes}, p.id LIMIT ${p.limit} OFFSET ${p.offset}`, params)).rows;
  return { rows, total };
}
async function byId(id, admin, c) {
  return (await (c || { query }).query(`SELECT ${columns(admin)} ${JOINS} WHERE p.id = $1`, [id])).rows[0];
}
async function images(id) { return (await query('SELECT id, image_url, is_primary, display_order FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC, display_order, id', [id])).rows; }
async function compatibilities(id) {
  return (await query(`SELECT mm.id AS motorcycle_model_id, mm.name AS model_name, mm.year_start, mm.year_end, mm.engine_displacement,
      mb.id AS brand_id, mb.name AS brand_name, pc.notes
      FROM product_compatibilities pc JOIN motorcycle_models mm ON mm.id = pc.motorcycle_model_id JOIN motorcycle_brands mb ON mb.id = mm.brand_id
      WHERE pc.product_id = $1 ORDER BY mb.name, mm.name`, [id])).rows;
}
const setCompat = async (c, id, list) => {
  await c.query('DELETE FROM product_compatibilities WHERE product_id=$1', [id]);
  for (const x of list) await c.query('INSERT INTO product_compatibilities (product_id, motorcycle_model_id, notes) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [id, x.motorcycle_model_id, x.notes || null]);
};
async function related(id, limit = 8) {
  return (await query(`SELECT ${columns(false)} ${JOINS}
    WHERE p.status='ativo' AND p.id <> $1 AND p.category_id = (SELECT category_id FROM products WHERE id=$1)
    ORDER BY (SELECT count(*) FROM product_compatibilities a JOIN product_compatibilities b2 ON b2.motorcycle_model_id=a.motorcycle_model_id
               WHERE a.product_id=$1 AND b2.product_id=p.id) DESC, sl.sold DESC LIMIT $2`, [id, limit])).rows;
}
module.exports = { search, byId, images, compatibilities, setCompat, related, columns, JOINS };
