const repo = require('./products.repository');
const { query, withTransaction } = require('../../database/pool');
const { audit } = require('../../services/audit.service');
const storage = require('../../services/storage.service');
const { paginate, pageMeta } = require('../../utils/helpers');
const { notFound, unprocessable } = require('../../utils/AppError');

const PUBLIC_HIDE = ['purchase_cost', 'reserved_quantity', 'minimum_quantity', 'quantity'];
const clean = (p, admin) => { if (!admin && p) PUBLIC_HIDE.forEach((k) => delete p[k]); return p; };

async function list(filters, admin) {
  const p = paginate(filters, 12, 60);
  const { rows, total } = await repo.search(filters, p, admin);
  return { rows: rows.map((r) => clean(r, admin)), meta: pageMeta(p, total) };
}

async function get(id, admin) {
  const prod = await repo.byId(id, admin);
  if (!prod || (!admin && prod.status !== 'ativo')) throw notFound('Produto não encontrado');   // RN003
  prod.images = await repo.images(id);
  prod.compatibilities = await repo.compatibilities(id);
  return clean(prod, admin);
}
const related = (id) => repo.related(id).then((r) => r.map((x) => clean(x, false)));

async function create(req, b) {
  const id = await withTransaction(async (c) => {
    const ins = await c.query(
      `INSERT INTO products (category_id, brand_id, name, reference, description, sale_price, purchase_cost, status, is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.category_id || null, b.brand_id || null, b.name, b.reference || null, b.description || null, b.sale_price, b.purchase_cost, b.status, b.is_featured]);
    const pid = ins.rows[0].id;
    await c.query('INSERT INTO inventory (product_id, quantity, minimum_quantity) VALUES ($1,$2,$3)', [pid, b.initial_quantity, b.minimum_quantity]);
    if (b.initial_quantity > 0) await c.query(`INSERT INTO inventory_movements (product_id, user_id, movement_type, quantity, reason) VALUES ($1,$2,'entrada',$3,'Estoque inicial')`, [pid, req.user.id, b.initial_quantity]);
    if (b.compatibilities) await repo.setCompat(c, pid, b.compatibilities);
    await audit(req, 'produto_criado', 'products', pid, null, { name: b.name, sale_price: b.sale_price, purchase_cost: b.purchase_cost }, c);
    return pid;
  });
  return get(id, true);
}

async function update(req, id, b) {
  const before = await repo.byId(id, true); if (!before) throw notFound('Produto não encontrado');
  await withTransaction(async (c) => {
    await c.query(`UPDATE products SET category_id=$2, brand_id=$3, name=$4, reference=$5, description=$6, sale_price=$7, purchase_cost=$8, status=$9, is_featured=$10 WHERE id=$1`,
      [id, b.category_id || null, b.brand_id || null, b.name, b.reference || null, b.description || null, b.sale_price, b.purchase_cost, b.status, b.is_featured]);
    await c.query('UPDATE inventory SET minimum_quantity=$2 WHERE product_id=$1', [id, b.minimum_quantity]);
    if (b.compatibilities) await repo.setCompat(c, id, b.compatibilities);
    // pedidos antigos NÃO são afetados: order_items guarda cópia de preço/custo (RN009/RF053)
    const priceChanged = Number(before.sale_price) !== b.sale_price || Number(before.purchase_cost) !== b.purchase_cost;
    await audit(req, priceChanged ? 'produto_preco_alterado' : 'produto_editado', 'products', id,
      { sale_price: before.sale_price, purchase_cost: before.purchase_cost, status: before.status },
      { sale_price: b.sale_price, purchase_cost: b.purchase_cost, status: b.status }, c);
  });
  return get(id, true);
}

// RF013: nunca apaga — desativa, preservando histórico de vendas
async function deactivate(req, id) {
  const before = await repo.byId(id, true); if (!before) throw notFound('Produto não encontrado');
  await query("UPDATE products SET status='inativo' WHERE id=$1", [id]);
  await audit(req, 'produto_desativado', 'products', id, { status: before.status }, { status: 'inativo' });
}

async function setCompat(req, id, list) {
  if (!(await repo.byId(id, true))) throw notFound('Produto não encontrado');
  await withTransaction(async (c) => { await repo.setCompat(c, id, list); await audit(req, 'compatibilidade_alterada', 'products', id, null, { count: list.length }, c); });
  return repo.compatibilities(id);
}

// ---- imagens ----
const MAGIC = { 'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8, 'image/png': (b) => b[0] === 0x89 && b[1] === 0x50, 'image/webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' };
async function addImages(req, id, files) {
  if (!(await repo.byId(id, true))) throw notFound('Produto não encontrado');
  if (!files || !files.length) throw unprocessable('Envie ao menos uma imagem');
  const existing = (await repo.images(id)).length;
  if (existing + files.length > 10) throw unprocessable('Limite de 10 imagens por produto');
  let order = existing;
  for (const f of files) {
    if (!MAGIC[f.mimetype] || !MAGIC[f.mimetype](f.buffer)) throw unprocessable('Arquivo de imagem inválido (use JPG, PNG ou WebP)');
    const url = await storage.saveImage(f.buffer, f.mimetype);
    await query('INSERT INTO product_images (product_id, image_url, is_primary, display_order) VALUES ($1,$2,$3,$4)', [id, url, order === 0, order]);
    order++;
  }
  await audit(req, 'produto_imagens_adicionadas', 'products', id, null, { count: files.length });
  return repo.images(id);
}
async function patchImage(req, id, imageId, b) {
  await withTransaction(async (c) => {
    if (b.is_primary) { await c.query('UPDATE product_images SET is_primary=FALSE WHERE product_id=$1', [id]); await c.query('UPDATE product_images SET is_primary=TRUE WHERE id=$1 AND product_id=$2', [imageId, id]); }
    if (b.display_order !== undefined) await c.query('UPDATE product_images SET display_order=$3 WHERE id=$1 AND product_id=$2', [imageId, id, b.display_order]);
  });
  return repo.images(id);
}
async function removeImage(req, id, imageId) {
  const r = await query('DELETE FROM product_images WHERE id=$1 AND product_id=$2 RETURNING image_url, is_primary', [imageId, id]);
  if (!r.rowCount) throw notFound('Imagem não encontrada');
  await storage.removeImage(r.rows[0].image_url);
  if (r.rows[0].is_primary) await query('UPDATE product_images SET is_primary=TRUE WHERE id=(SELECT id FROM product_images WHERE product_id=$1 ORDER BY display_order, id LIMIT 1)', [id]);
  return repo.images(id);
}
module.exports = { list, get, related, create, update, deactivate, setCompat, addImages, patchImage, removeImage };
