// Dados de demonstração (catálogo de exemplo). Não use em produção com dados reais.
const { pool } = require('./pool');
const { seed } = require('./seed');

const PLACEHOLDER = '/assets/images/placeholder-produto.svg';
const motoBrands = { Honda: [['CG 160 Titan', 2016, null, 160], ['CG 125 Fan', 2009, 2015, 125], ['Biz 125', 2012, null, 125], ['CB 300F Twister', 2015, null, 300], ['XRE 300', 2010, null, 300], ['Pop 110i', 2015, null, 110]],
  Yamaha: [['Factor 150', 2016, null, 150], ['Fazer 250', 2011, null, 250], ['XTZ 250 Lander', 2007, null, 250], ['Crosser 150', 2014, null, 150]],
  Suzuki: [['GSX-S750', 2017, null, 750], ['Yes 125', 2005, 2018, 125]], Kawasaki: [['Ninja 400', 2018, null, 400]] };
// [nome, ref, categoria, fabricante, preço, custo, estoque, mínimo, destaque, modelos compatíveis, descrição]
const products = [
  ['Pastilha de Freio Dianteira', 'PF-CG160-D', 'Freios', 'Cobreq', 45.9, 24, 30, 5, true, ['CG 160 Titan', 'CG 125 Fan'], 'Pastilha de freio dianteira de alta durabilidade.'],
  ['Pastilha de Freio Traseira', 'PF-CG160-T', 'Freios', 'Cobreq', 39.9, 20, 25, 5, false, ['CG 160 Titan'], 'Pastilha traseira com excelente frenagem.'],
  ['Disco de Freio Dianteiro', 'DF-FAZER250', 'Freios', 'Fremax', 189.9, 110, 8, 3, false, ['Fazer 250', 'XTZ 250 Lander'], 'Disco de freio ventilado.'],
  ['Kit Relação Completo 428H', 'KR-428-CG', 'Transmissão', 'Riffel', 129.9, 72, 15, 4, true, ['CG 160 Titan', 'CG 125 Fan', 'Biz 125'], 'Coroa, pinhão e corrente com retentor.'],
  ['Corrente de Transmissão 520', 'CT-520-120', 'Transmissão', 'DID', 159.9, 95, 10, 3, false, ['CB 300F Twister', 'XRE 300', 'Ninja 400'], 'Corrente 520 com 120 elos.'],
  ['Filtro de Óleo', 'FO-HONDA-01', 'Motor', 'Mahle', 19.9, 8, 60, 10, false, ['CG 160 Titan', 'Biz 125', 'Pop 110i'], 'Filtro de óleo original.'],
  ['Vela de Ignição NGK', 'VI-NGK-CR8', 'Elétrica', 'NGK', 24.9, 11, 40, 10, true, ['CG 160 Titan', 'Factor 150', 'XRE 300'], 'Vela de ignição de alta performance.'],
  ['Bateria 12V 6Ah', 'BAT-12V-6A', 'Elétrica', 'Moura', 149.9, 92, 12, 4, false, ['CG 160 Titan', 'Biz 125', 'Factor 150'], 'Bateria selada livre de manutenção.'],
  ['Amortecedor Traseiro Par', 'AM-TR-CG', 'Suspensão', 'Cofap', 199.9, 120, 6, 2, true, ['CG 160 Titan', 'CG 125 Fan'], 'Par de amortecedores traseiros.'],
  ['Retentor de Bengala', 'RB-CG-01', 'Suspensão', 'Sabó', 34.9, 15, 20, 5, false, ['CG 160 Titan', 'Factor 150'], 'Retentor para bengala dianteira.'],
  ['Retrovisor Esquerdo', 'RV-UNIV-E', 'Acessórios', 'Pro Tork', 39.9, 18, 18, 4, false, ['CG 160 Titan', 'Biz 125', 'Pop 110i'], 'Retrovisor com haste curta.'],
  ['Manopla de Borracha', 'MN-UNIV', 'Acessórios', 'Pro Tork', 29.9, 12, 0, 5, false, ['CG 160 Titan', 'Factor 150'], 'Par de manoplas antiderrapantes (sem estoque — teste).'],
  ['Pistão com Anéis 0.50', 'PI-CG160-050', 'Motor', 'Metal Leve', 219.9, 130, 5, 2, false, ['CG 160 Titan'], 'Pistão com anéis e pino.'],
  ['Lâmpada Farol H4', 'LF-H4-35', 'Elétrica', 'Osram', 22.9, 9, 35, 8, false, ['CG 160 Titan', 'Factor 150', 'XTZ 250 Lander'], 'Lâmpada H4 35/35W.'],
];

(async () => {
  await seed();
  for (const [brand, models] of Object.entries(motoBrands)) {
    const b = await pool.query(`INSERT INTO motorcycle_brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [brand]);
    for (const [name, ys, ye, cc] of models) {
      await pool.query(`INSERT INTO motorcycle_models (brand_id,name,year_start,year_end,engine_displacement)
        SELECT $1::bigint,$2::varchar,$3::smallint,$4::smallint,$5::int WHERE NOT EXISTS (SELECT 1 FROM motorcycle_models WHERE brand_id=$1::bigint AND name=$2::varchar)`, [b.rows[0].id, name, ys, ye, cc]);
    }
  }
  for (const [name, ref, cat, brand, price, cost, qty, min, feat, models, desc] of products) {
    if ((await pool.query('SELECT 1 FROM products WHERE reference=$1', [ref])).rowCount) continue;
    const br = await pool.query(`INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [brand]);
    const c = await pool.query('SELECT id FROM categories WHERE name=$1 AND parent_id IS NULL', [cat]);
    const p = await pool.query(
      `INSERT INTO products (category_id,brand_id,name,reference,description,sale_price,purchase_cost,is_featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [c.rows[0].id, br.rows[0].id, name, ref, desc, price, cost, feat]);
    const id = p.rows[0].id;
    await pool.query('INSERT INTO inventory (product_id, quantity, minimum_quantity) VALUES ($1,$2,$3)', [id, qty, min]);
    if (qty > 0) await pool.query(`INSERT INTO inventory_movements (product_id, movement_type, quantity, reason) VALUES ($1,'entrada',$2,'Estoque inicial (demo)')`, [id, qty]);
    await pool.query('INSERT INTO product_images (product_id, image_url, is_primary) VALUES ($1,$2,TRUE)', [id, PLACEHOLDER]);
    await pool.query(`INSERT INTO product_compatibilities (product_id, motorcycle_model_id)
      SELECT $1, id FROM motorcycle_models WHERE name = ANY($2::text[])`, [id, models]);
  }
  console.log('[seed-demo] catálogo de demonstração criado.');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
