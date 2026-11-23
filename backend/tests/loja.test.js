const test = require('node:test');
const assert = require('node:assert');
const h = require('./helper');
const { api, login, pool } = h;

const customer = { name: 'João da Silva', phone: '(88) 99999-1111', email: 'joao@email.com' };
const address = { street: 'Rua das Flores', number: '100', neighborhood: 'Centro', city: 'Crato', state: 'CE', postal_code: '63100-000' };
let admin; let prodA; let prodB;

test.before(async () => {
  await h.setup();
  admin = await login();
  const mk = (name, ref, price, cost, qty) => api('POST', '/products', { cookies: admin, body: { name, reference: ref, sale_price: price, purchase_cost: cost, initial_quantity: qty, minimum_quantity: 2 } });
  prodA = (await mk('Pastilha Teste', 'PT-1', 50, 30, 5)).body.data;
  prodB = (await mk('Corrente Teste', 'CT-1', 100, 60, 10)).body.data;
});
test.after(h.teardown);

const order = (items, extra = {}) => api('POST', '/orders', { body: { customer, receiving_method: 'entrega', address, items, whatsapp_consent: false, ...extra } });
const stock = async (id) => (await pool.query('SELECT quantity, reserved_quantity FROM inventory WHERE product_id=$1', [id])).rows[0];

test('autenticação: login errado, login certo, rota protegida', async () => {
  assert.strictEqual((await login('admin@teste.com', 'errada123')).status, 401);
  assert.strictEqual((await api('GET', '/orders')).status, 401);
  assert.strictEqual(admin.user.is_admin, true);
});

test('CSRF: operação administrativa sem token é recusada', async () => {
  const r = await api('POST', '/categories', { cookies: { cookie: admin.cookie, csrf: 'errado' }, body: { name: 'X' } });
  assert.strictEqual(r.status, 403);
});

test('catálogo público não expõe custo nem estoque físico', async () => {
  const r = await api('GET', `/products/${prodA.id}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.data.purchase_cost, undefined);
  assert.strictEqual(r.body.data.available_quantity, 5);
});

test('pedido: registra, reserva estoque, copia preço e devolve link do WhatsApp', async () => {
  const r = await order([{ product_id: prodA.id, quantity: 2 }]);
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  const d = r.body.data;
  assert.match(d.order_code, /^\d{6}$/);
  assert.ok(d.tracking_token.length > 30);
  assert.ok(d.whatsapp_url.startsWith('https://wa.me/55'));
  assert.ok(d.delivery_fee >= 8);                       // frete mínimo configurado
  assert.strictEqual(d.total, 100 + d.delivery_fee);
  const s = await stock(prodA.id);
  assert.deepStrictEqual([s.quantity, s.reserved_quantity], [5, 2]);
  const tok = (await pool.query('SELECT tracking_token_hash FROM orders WHERE order_code=$1', [d.order_code])).rows[0].tracking_token_hash;
  assert.notStrictEqual(tok, d.tracking_token);          // só o hash é armazenado
});

test('pedido fora da região atendida é recusado e não reserva nada', async () => {
  const before = await stock(prodB.id);
  const r = await order([{ product_id: prodB.id, quantity: 1 }], { address: { ...address, city: 'Fortaleza' } });
  assert.strictEqual(r.status, 422);
  assert.deepStrictEqual(await stock(prodB.id), before);
});

test('concorrência: 8 pedidos simultâneos de 1 un. com 3 disponíveis → exatamente 3 aceitos', async () => {
  const p = (await api('POST', '/products', { cookies: admin, body: { name: 'Raro', sale_price: 10, initial_quantity: 3 } })).body.data;
  const res = await Promise.all(Array.from({ length: 8 }, () => order([{ product_id: p.id, quantity: 1 }], { receiving_method: 'retirada', address: null })));
  const okCount = res.filter((r) => r.status === 201).length;
  assert.strictEqual(okCount, 3);
  assert.ok(res.filter((r) => r.status !== 201).every((r) => r.status === 409));
  const s = await stock(p.id); assert.strictEqual(s.reserved_quantity, 3);
});

test('acompanhamento exige token correto', async () => {
  const o = (await order([{ product_id: prodB.id, quantity: 1 }])).body.data;
  assert.strictEqual((await api('GET', `/tracking/${o.order_code}`)).status, 404);
  assert.strictEqual((await api('GET', `/tracking/${o.order_code}`, { headers: { 'X-Tracking-Token': 'errado' } })).status, 404);
  const ok = await api('GET', `/tracking/${o.order_code}`, { headers: { 'X-Tracking-Token': o.tracking_token } });
  assert.strictEqual(ok.status, 200); assert.strictEqual(ok.body.data.status, 'pedido_recebido');
  assert.strictEqual(ok.body.data.customer_phone, undefined);
});

test('fluxo completo: confirmar → preparar → sair → entregar (baixa estoque, pagamento, lucro) → avaliar', async () => {
  const o = (await order([{ product_id: prodB.id, quantity: 2 }])).body.data;
  const id = (await pool.query('SELECT id FROM orders WHERE order_code=$1', [o.order_code])).rows[0].id;
  const st = (status, extra = {}) => api('PATCH', `/orders/${id}/status`, { cookies: admin, body: { status, ...extra } });

  assert.strictEqual((await st('pedido_entregue')).status, 409);                    // transição inválida
  assert.strictEqual((await st('pedido_confirmado', { delivery_fee: 12.5 })).status, 200);
  assert.strictEqual((await pool.query('SELECT reservation_expires_at FROM orders WHERE id=$1', [id])).rows[0].reservation_expires_at, null);
  await st('preparando_pedido');
  assert.strictEqual((await st('pedido_entregue')).status, 422);                    // entrega precisa "sair para entrega"
  assert.strictEqual((await st('saiu_para_entrega', { estimated_delivery_at: new Date(Date.now() + 3600e3).toISOString() })).status, 200);
  const before = await stock(prodB.id);
  const done = await st('pedido_entregue', { payment: { payment_method: 'pix' } });
  assert.strictEqual(done.status, 200, JSON.stringify(done.body));
  const after = await stock(prodB.id);
  assert.strictEqual(before.quantity - after.quantity, 2); assert.strictEqual(before.reserved_quantity - after.reserved_quantity, 2);
  assert.strictEqual(done.body.data.payment_status, 'pago');
  assert.strictEqual(done.body.data.total, 200 + 12.5);
  assert.strictEqual(done.body.data.profit, 80);                                      // (100-60)*2

  const t = await api('GET', `/tracking/${o.order_code}`, { headers: { 'X-Tracking-Token': o.tracking_token } });
  const item = t.body.data.items[0]; assert.strictEqual(item.can_review, true);
  const rev = await api('POST', '/reviews', { headers: { 'X-Tracking-Token': o.tracking_token }, body: { code: o.order_code, order_item_id: item.id, rating: 5, comment: 'Ótima peça' } });
  assert.strictEqual(rev.status, 201);
  assert.strictEqual((await api('POST', '/reviews', { headers: { 'X-Tracking-Token': o.tracking_token }, body: { code: o.order_code, order_item_id: item.id, rating: 4 } })).status, 409);
  const list = await api('GET', `/products/${prodB.id}/reviews`);
  assert.strictEqual(list.body.data.summary.count, 1); assert.strictEqual(list.body.data.summary.average, 5);
});

test('avaliação antes da entrega é recusada', async () => {
  const o = (await order([{ product_id: prodA.id, quantity: 1 }])).body.data;
  const t = await api('GET', `/tracking/${o.order_code}`, { headers: { 'X-Tracking-Token': o.tracking_token } });
  const r = await api('POST', '/reviews', { headers: { 'X-Tracking-Token': o.tracking_token }, body: { code: o.order_code, order_item_id: t.body.data.items[0].id, rating: 5 } });
  assert.strictEqual(r.status, 422);
});

test('cancelamento libera a reserva; cliente cancela pedido não confirmado', async () => {
  const before = await stock(prodA.id);
  const o = (await order([{ product_id: prodA.id, quantity: 1 }])).body.data;
  assert.strictEqual((await stock(prodA.id)).reserved_quantity, before.reserved_quantity + 1);
  const c = await api('POST', `/tracking/${o.order_code}/cancel`, { headers: { 'X-Tracking-Token': o.tracking_token }, body: { reason: 'Desisti' } });
  assert.strictEqual(c.status, 200);
  assert.deepStrictEqual(await stock(prodA.id), before);
});

test('cancelamento pelo painel exige motivo e libera estoque', async () => {
  const before = await stock(prodA.id);
  const o = (await order([{ product_id: prodA.id, quantity: 1 }])).body.data;
  const id = (await pool.query('SELECT id FROM orders WHERE order_code=$1', [o.order_code])).rows[0].id;
  assert.strictEqual((await api('PATCH', `/orders/${id}/status`, { cookies: admin, body: { status: 'pedido_cancelado' } })).status, 422);
  assert.strictEqual((await api('PATCH', `/orders/${id}/status`, { cookies: admin, body: { status: 'pedido_cancelado', notes: 'Cliente não atendeu' } })).status, 200);
  assert.deepStrictEqual(await stock(prodA.id), before);
});

test('expiração: reserva vencida cancela o pedido e devolve o estoque', async () => {
  const before = await stock(prodB.id);
  const o = (await order([{ product_id: prodB.id, quantity: 3 }])).body.data;
  await pool.query("UPDATE orders SET reservation_expires_at = now() - interval '1 minute' WHERE order_code=$1", [o.order_code]);
  const n = await require('../src/modules/orders/orders.service').expireReservations();
  assert.ok(n >= 1);
  assert.deepStrictEqual(await stock(prodB.id), before);
  assert.strictEqual((await pool.query('SELECT status FROM orders WHERE order_code=$1', [o.order_code])).rows[0].status, 'pedido_cancelado');
});

test('promoção: preço promocional é aplicado e copiado ao pedido; desconto inválido é recusado', async () => {
  const bad = await api('POST', '/promotions', { cookies: admin, body: { name: 'Ruim', discount_type: 'fixo', discount_value: 60, start_at: new Date(Date.now() - 1e3).toISOString(), end_at: new Date(Date.now() + 864e5).toISOString(), product_ids: [prodA.id] } });
  assert.strictEqual(bad.status, 422);                                               // 50 - 60 < 0 (RN031)
  const p = await api('POST', '/promotions', { cookies: admin, body: { name: '20% off', discount_type: 'percentual', discount_value: 20, start_at: new Date(Date.now() - 1e3).toISOString(), end_at: new Date(Date.now() + 864e5).toISOString(), product_ids: [prodA.id] } });
  assert.strictEqual(p.status, 201);
  assert.strictEqual((await api('GET', `/products/${prodA.id}`)).body.data.promo_price, 40);
  const o = (await order([{ product_id: prodA.id, quantity: 1 }], { receiving_method: 'retirada', address: null })).body.data;
  assert.strictEqual(o.total, 40); assert.strictEqual(o.discount_total, 10);
  await api('PUT', `/products/${prodA.id}`, { cookies: admin, body: { name: 'Pastilha Teste', sale_price: 80, purchase_cost: 30, status: 'ativo', is_featured: false, minimum_quantity: 2 } });
  const row = (await pool.query('SELECT unit_price FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.order_code=$1', [o.order_code])).rows[0];
  assert.strictEqual(row.unit_price, 40);                                            // pedido antigo não muda (RN009)
});

test('permissões: atendente não altera estoque nem cria usuários; bloqueado não loga', async () => {
  const roles = (await api('GET', '/roles', { cookies: admin })).body.data;
  const att = roles.find((r) => r.name === 'Atendente');
  const u = await api('POST', '/users', { cookies: admin, body: { name: 'Maria', email: 'maria@teste.com', password: 'Senha@9999', role_ids: [att.id] } });
  assert.strictEqual(u.status, 201);
  const m = await login('maria@teste.com', 'Senha@9999');
  assert.strictEqual((await api('POST', '/inventory/movements', { cookies: m, body: { product_id: prodA.id, movement_type: 'entrada', quantity: 1 } })).status, 403);
  assert.strictEqual((await api('POST', '/users', { cookies: m, body: { name: 'X', email: 'x@x.com', password: 'Senha@9999', role_ids: [att.id] } })).status, 403);
  assert.strictEqual((await api('GET', '/orders', { cookies: m })).status, 200);
  assert.strictEqual((await api('PATCH', `/users/${u.body.data.id}/status`, { cookies: admin, body: { status: 'bloqueado' } })).status, 200);
  assert.strictEqual((await api('GET', '/orders', { cookies: m })).status, 401);    // sessão encerrada ao bloquear
  assert.strictEqual((await login('maria@teste.com', 'Senha@9999')).status, 403);
});

test('estoque: saída acima do disponível é recusada; histórico e alertas', async () => {
  const s = await stock(prodA.id);
  assert.strictEqual((await api('POST', '/inventory/movements', { cookies: admin, body: { product_id: prodA.id, movement_type: 'saida', quantity: s.quantity + 5 } })).status, 409);
  assert.strictEqual((await api('POST', '/inventory/movements', { cookies: admin, body: { product_id: prodA.id, movement_type: 'ajuste_negativo', quantity: 1 } })).status, 422); // motivo obrigatório
  assert.strictEqual((await api('POST', '/inventory/movements', { cookies: admin, body: { product_id: prodA.id, movement_type: 'entrada', quantity: 10 } })).status, 201);
  assert.ok((await api('GET', '/inventory/movements?limit=5', { cookies: admin })).body.data.length > 0);
});

test('relatórios e dashboard respondem; auditoria é imutável', async () => {
  const sum = await api('GET', '/reports/summary', { cookies: admin });
  assert.strictEqual(sum.status, 200); assert.ok(sum.body.data.completed_orders >= 1); assert.ok(sum.body.data.gross_profit > 0);
  for (const p of ['/reports/sales?period=month', '/reports/top-products', '/reports/low-movement', '/reports/cancelled', '/reports/payment-methods', '/reports/dashboard'])
    assert.strictEqual((await api('GET', p, { cookies: admin })).status, 200, p);
  await assert.rejects(pool.query('DELETE FROM audit_logs'), /imutável/);
  assert.ok((await api('GET', '/audit', { cookies: admin })).body.data.length > 0);
});

test('busca por modelo de moto e filtros', async () => {
  const mb = (await api('POST', '/motorcycles/brands', { cookies: admin, body: { name: 'Honda' } })).body.data;
  const mm = (await api('POST', '/motorcycles/models', { cookies: admin, body: { brand_id: mb.id, name: 'CG 160 Titan', year_start: 2016 } })).body.data;
  await api('PUT', `/products/${prodB.id}/compatibilities`, { cookies: admin, body: { compatibilities: [{ motorcycle_model_id: mm.id }] } });
  const r = await api('GET', '/products?q=honda+titan'); assert.deepStrictEqual(r.body.data.map((p) => p.id), [prodB.id]);
  assert.strictEqual((await api('GET', `/products?moto_model_id=${mm.id}`)).body.data.length, 1);
  assert.strictEqual((await api('GET', '/products?q=corrente&in_stock=1')).body.data.length, 1);
});

test('notificação WhatsApp: com autorização é registrada (mesmo sem API) e não afeta o pedido; sem autorização não envia', async () => {
  const a = (await order([{ product_id: prodB.id, quantity: 1 }], { whatsapp_consent: true })).body.data;
  const b = (await order([{ product_id: prodB.id, quantity: 1 }], { whatsapp_consent: false })).body.data;
  await new Promise((r) => setTimeout(r, 600));                       // envio é em segundo plano
  const n = async (code) => (await pool.query('SELECT n.status, n.notification_type FROM notifications n JOIN orders o ON o.id=n.order_id WHERE o.order_code=$1', [code])).rows;
  const na = await n(a.order_code); assert.strictEqual(na.length, 1); assert.strictEqual(na[0].status, 'nao_configurado');
  assert.strictEqual((await n(b.order_code)).length, 0);              // RN018
  assert.strictEqual((await pool.query('SELECT status FROM orders WHERE order_code=$1', [a.order_code])).rows[0].status, 'pedido_recebido');   // RN020
});

test('estimativa de frete aceita campos nulos e recusa região não atendida', async () => {
  const ok = await api('POST', '/delivery/estimate', { body: { city: 'Crato', state: 'CE', street: null, number: null, neighborhood: null, postal_code: null } });
  assert.strictEqual(ok.status, 200); assert.ok(ok.body.data.fee >= 8);
  assert.strictEqual((await api('POST', '/delivery/estimate', { body: { city: 'Recife', state: 'PE' } })).status, 422);
});
