const { query, withTransaction } = require('../../database/pool');
const { audit } = require('../../services/audit.service');
const { notFound, unprocessable } = require('../../utils/AppError');

const LIST = `SELECT pr.*, COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name, 'sale_price', p.sale_price)) FILTER (WHERE p.id IS NOT NULL), '[]') AS products,
  (pr.status AND now() BETWEEN pr.start_at AND pr.end_at) AS is_active_now
  FROM promotions pr LEFT JOIN promotion_products pp ON pp.promotion_id = pr.id LEFT JOIN products p ON p.id = pp.product_id`;
const list = async () => (await query(`${LIST} GROUP BY pr.id ORDER BY pr.start_at DESC`)).rows;
const get = async (id) => (await query(`${LIST} WHERE pr.id=$1 GROUP BY pr.id`, [id])).rows[0];

// RN031: impede descontos que gerem preço inválido (≤ 0)
async function assertValid(b) {
  if (b.discount_type !== 'fixo') return;
  const { rows } = await query('SELECT name, sale_price FROM products WHERE id = ANY($1::bigint[]) AND sale_price <= $2', [b.product_ids, b.discount_value]);
  if (rows.length) throw unprocessable(`Desconto fixo inválido: resultaria em preço zero ou negativo em "${rows[0].name}"`);
}

async function save(req, id, b) {
  await assertValid(b);
  if (id && !(await get(id))) throw notFound('Promoção não encontrada');
  const pid = await withTransaction(async (c) => {
    let promoId = id;
    if (id) await c.query('UPDATE promotions SET name=$2, description=$3, discount_type=$4, discount_value=$5, start_at=$6, end_at=$7, status=$8 WHERE id=$1',
      [id, b.name, b.description || null, b.discount_type, b.discount_value, b.start_at, b.end_at, b.status]);
    else promoId = (await c.query('INSERT INTO promotions (name, description, discount_type, discount_value, start_at, end_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [b.name, b.description || null, b.discount_type, b.discount_value, b.start_at, b.end_at, b.status])).rows[0].id;
    await c.query('DELETE FROM promotion_products WHERE promotion_id=$1', [promoId]);
    await c.query('INSERT INTO promotion_products (promotion_id, product_id) SELECT $1, unnest($2::bigint[])', [promoId, b.product_ids]);
    await audit(req, id ? 'promocao_editada' : 'promocao_criada', 'promotions', promoId, null, b, c);
    return promoId;
  });
  return get(pid);
}
async function remove(req, id) {
  const old = await get(id); if (!old) throw notFound('Promoção não encontrada');
  await query('DELETE FROM promotions WHERE id=$1', [id]);
  await audit(req, 'promocao_removida', 'promotions', id, old);
}
// RF081: encerramento automático (chamado pelo agendador)
const closeExpired = async () => (await query('UPDATE promotions SET status=FALSE WHERE status AND end_at < now()')).rowCount;
module.exports = { list, get, save, remove, closeExpired };
