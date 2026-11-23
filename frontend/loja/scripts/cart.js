(async function () {
  const { h, $, mount, brl, api, imgUrl } = MP; await MP.ready;
  const root = $('#cart'); let regions = []; let ship = null; try { ship = JSON.parse(localStorage.getItem('mp_ship')); } catch (_) {}
  try { regions = (await api.get('/delivery/regions')).data; } catch (_) {}

  // Revalida preços e estoque com o servidor
  async function refresh() {
    const items = MP.cart.items(); const msgs = [];
    await Promise.all(items.map(async (i) => {
      try { const { data: p } = await api.get(`/products/${i.id}`);
        if (p.available_quantity <= 0) { MP.cart.remove(i.id); msgs.push(`"${i.name}" ficou indisponível e foi removido.`); return; }
        if (p.final_price !== i.price) msgs.push(`O preço de "${i.name}" mudou para ${brl(p.final_price)}.`);
        if (i.qty > p.available_quantity) msgs.push(`Só há ${p.available_quantity} un. de "${i.name}".`);
        const all = MP.cart.items(); const x = all.find((y) => y.id === i.id); x.price = p.final_price; x.max = p.available_quantity; x.name = p.name; x.image = p.image_url; if (x.qty > x.max) x.qty = x.max; localStorage.setItem('mp_cart_v1', JSON.stringify(all));
      } catch (e) { if (e.status === 404) { MP.cart.remove(i.id); msgs.push(`"${i.name}" não está mais à venda.`); } }
    })); return msgs;
  }

  function render(msgs = []) {
    const items = MP.cart.items();
    if (!items.length) return mount(root, h('div', { class: 'empty card' }, h('p', { style: 'font-size:3rem;margin:0' }, '🛒'), h('p', {}, 'Seu carrinho está vazio.'), h('a', { class: 'btn', href: '/loja/pages/catalogo.html' }, 'Ver peças')));
    const sub = MP.cart.subtotal();
    const city = h('select', { id: 'city', 'aria-label': 'Cidade de entrega' }, h('option', { value: '' }, 'Selecione a cidade'), regions.map((r) => h('option', { value: `${r.city}|${r.state}`, selected: ship && ship.city === r.city }, `${r.city}/${r.state}`)));
    const out = h('div', { class: 'small', style: 'margin-top:8px' }, ship && ship.fee != null ? `Frete estimado: ${brl(ship.fee)}` : '');
    const calc = async () => { const [c, st] = city.value.split('|'); if (!c) return; try { const r = (await api.post('/delivery/estimate', { city: c, state: st })).data; ship = { city: c, state: st, fee: r.fee }; localStorage.setItem('mp_ship', JSON.stringify(ship)); mount(out, `Frete estimado: ${brl(r.fee)} — ${r.note}`); totalEl.textContent = brl(sub + r.fee); } catch (e) { mount(out, h('span', { style: 'color:var(--red)' }, e.message)); } };
    const totalEl = h('b', {}, brl(sub + (ship && ship.fee ? ship.fee : 0)));
    mount(root, h('div', { class: 'cols' },
      h('div', { class: 'card' }, msgs.map((m) => h('div', { class: 'alert warn' }, m)),
        items.map((i) => h('div', { class: 'cart-item' }, h('img', { src: imgUrl(i.image), alt: '' }),
          h('div', {}, h('a', { href: `/loja/pages/produto.html?id=${i.id}`, style: 'font-weight:600;color:inherit' }, i.name), h('div', { class: 'muted small' }, `${brl(i.price)} cada`), h('button', { class: 'btn secondary small', style: 'margin-top:6px', onclick: () => { MP.cart.remove(i.id); render(); } }, 'Remover')),
          h('div', { class: 'right' }, h('div', { class: 'qty' }, h('button', { 'aria-label': 'Diminuir', onclick: () => { MP.cart.set(i.id, i.qty - 1); render(); } }, '−'), h('input', { type: 'number', value: i.qty, min: 1, max: i.max, 'aria-label': 'Quantidade', onchange: (e) => { MP.cart.set(i.id, Number(e.target.value) || 1); render(); } }), h('button', { 'aria-label': 'Aumentar', onclick: () => { MP.cart.set(i.id, i.qty + 1); render(); } }, '+')), h('div', { class: 'price', style: 'font-size:1.1rem;margin-top:6px' }, brl(i.price * i.qty)))))),
      h('aside', { class: 'card summary' }, h('h3', {}, 'Resumo'), h('div', { class: 'line' }, h('span', {}, 'Subtotal'), h('b', {}, brl(sub))),
        h('div', { class: 'field', style: 'margin-top:10px' }, h('label', { for: 'city' }, 'Estimar frete'), city, h('button', { class: 'btn secondary small', type: 'button', onclick: calc }, 'Calcular'), out,
          h('span', { class: 'hint' }, 'O valor final é confirmado pelo responsável antes da entrega.')),
        h('div', { class: 'line total' }, h('span', {}, 'Total estimado'), totalEl),
        h('a', { class: 'btn block', href: '/loja/pages/checkout.html' }, 'Finalizar pedido'), h('a', { class: 'btn secondary block', style: 'margin-top:8px', href: '/loja/pages/catalogo.html' }, 'Continuar comprando'),
        h('p', { class: 'small muted', style: 'margin:12px 0 0' }, '💳 Pagamento na entrega (Pix preferencialmente). Sem necessidade de cadastro.'))));
  }
  render(); render(await refresh());
})();
