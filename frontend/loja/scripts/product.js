(async function () {
  const { h, $, mount, brl, api, imgUrl } = MP; await MP.ready;
  const id = MP.getParam('id'); const root = $('#pdp');
  if (!id) return mount(root, h('div', { class: 'empty' }, 'Produto não informado.'));
  try {
    const [{ data: p }, rel, rev, s] = await Promise.all([api.get(`/products/${id}`), api.get(`/products/${id}/related`).catch(() => ({ data: [] })), api.get(`/products/${id}/reviews`).catch(() => ({ data: { summary: { count: 0 }, reviews: [] } })), MP.settings()]);
    document.title = `${p.name} — Moto Peças Sistem`;
    const imgs = p.images.length ? p.images : [{ image_url: null }]; let cur = 0;
    const main = h('img', { src: imgUrl(imgs[0].image_url), alt: p.name, width: 800, height: 800 });
    const thumbs = h('div', { class: 'thumbs' }, imgs.length > 1 ? imgs.map((im, i) => h('button', { type: 'button', class: i === 0 ? 'on' : '', 'aria-label': `Foto ${i + 1}`, onclick: (e) => { main.src = imgUrl(im.image_url); [...thumbs.children].forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, h('img', { src: imgUrl(im.image_url), alt: '' }))) : null);
    const out = p.available_quantity <= 0; const promo = p.promo_price != null;
    const qty = h('input', { type: 'number', min: 1, max: Math.max(p.available_quantity, 1), value: 1, 'aria-label': 'Quantidade' });
    const clamp = () => { qty.value = Math.max(1, Math.min(Number(qty.value) || 1, p.available_quantity)); };
    const add = () => { clamp(); if (MP.cart.add(p, Number(qty.value))) { MP.toast('Adicionado ao carrinho', 'success'); return true; } return false; };
    const groups = {}; p.compatibilities.forEach((c) => (groups[c.brand_name] = groups[c.brand_name] || []).push(c));
    const years = (c) => (c.year_start ? ` (${c.year_start}${c.year_end ? '–' + c.year_end : '+'})` : '');
    const wa = s.store_phone ? h('a', { class: 'btn whatsapp', href: MP.waLink(s, `Olá! Tenho uma dúvida sobre a peça: ${p.name}${p.reference ? ' (ref. ' + p.reference + ')' : ''}.`), target: '_blank', rel: 'noopener' }, '💬 Tirar dúvida no WhatsApp') : null;

    mount(root,
      h('div', { class: 'crumbs' }, h('a', { href: '/' }, 'Início'), ' › ', p.category_name ? h('a', { href: `/loja/pages/catalogo.html?category_id=${p.category_id}` }, p.category_name) : null, p.category_name ? ' › ' : null, h('span', {}, p.name)),
      h('div', { class: 'pdp' },
        h('div', { class: 'gallery' }, h('div', { class: 'main' }, main), thumbs),
        h('div', { class: 'stack' },
          p.brand_name ? h('span', { class: 'brand muted small' }, p.brand_name.toUpperCase()) : null, h('h1', {}, p.name),
          h('div', { class: 'row small' }, p.reference ? h('span', { class: 'muted' }, `Ref.: ${p.reference}`) : null, p.reviews_count ? h('span', {}, MP.stars(p.avg_rating), ` ${p.avg_rating} (${p.reviews_count} avaliações)`) : h('span', { class: 'muted' }, 'Sem avaliações ainda')),
          h('div', {}, promo ? h('div', { class: 'row' }, h('span', { class: 'price-old' }, brl(p.sale_price)), h('span', { class: 'badge red' }, `-${Math.round((1 - p.promo_price / p.sale_price) * 100)}% ${p.promo_name || ''}`)) : null, h('div', { class: 'price' }, brl(p.final_price)),
            h('div', { class: 'small muted' }, `Pagamento na entrega: ${(s.payment_methods || []).map((m) => MP.PAYMENT[m]).join(', ')}.`)),
          out ? h('div', { class: 'alert warn' }, 'Produto indisponível no momento. Fale com a gente — podemos encomendar.') : h('div', { class: 'avail ' + (p.available_quantity <= 3 ? 'low' : 'ok') }, p.available_quantity <= 3 ? `Últimas ${p.available_quantity} unidades!` : `Em estoque (${p.available_quantity} un.)`),
          // compatibilidade em destaque, para evitar compra de peça incompatível
          h('div', { class: 'card', style: 'box-shadow:none;border-color:#b9d9fa;background:var(--blue-soft)' }, h('b', {}, '🏍️ Compatibilidade'),
            p.compatibilities.length ? h('div', { class: 'small', style: 'margin-top:6px' }, Object.entries(groups).map(([b, list]) => h('div', {}, h('b', {}, b + ': '), list.map((c) => `${c.model_name}${years(c)}`).join(', '))))
              : h('div', { class: 'small', style: 'margin-top:6px' }, 'Compatibilidade não informada. Confirme com a gente antes de comprar.')),
          out ? null : h('div', { class: 'row' }, h('div', { class: 'qty' }, h('button', { type: 'button', 'aria-label': 'Diminuir', onclick: () => { qty.value = Number(qty.value) - 1; clamp(); } }, '−'), qty, h('button', { type: 'button', 'aria-label': 'Aumentar', onclick: () => { qty.value = Number(qty.value) + 1; clamp(); } }, '+')),
            h('button', { class: 'btn', style: 'flex:1', type: 'button', onclick: add }, '🛒 Adicionar ao carrinho'), h('button', { class: 'btn secondary', type: 'button', onclick: () => { if (add()) location.href = '/loja/pages/carrinho.html'; } }, 'Comprar agora')),
          wa)),
      p.description ? h('div', { class: 'tabs-box' }, h('h2', {}, 'Descrição'), h('p', { style: 'white-space:pre-line' }, p.description)) : null,
      h('div', { class: 'tabs-box' }, h('h2', {}, 'Avaliações de clientes'),
        rev.data.summary.count ? h('p', {}, MP.stars(rev.data.summary.average), ` ${rev.data.summary.average} · ${rev.data.summary.count} avaliação(ões)`) : h('p', { class: 'muted' }, 'Ainda não há avaliações. Compradores podem avaliar após a entrega.'),
        rev.data.reviews.map((r) => h('div', { class: 'review' }, h('div', { class: 'row between' }, h('b', {}, r.customer_name), h('span', { class: 'small muted' }, MP.date(r.created_at))), MP.stars(r.rating), r.comment ? h('p', { style: 'margin:6px 0 0;white-space:pre-line' }, r.comment) : null))),
      rel.data.length ? h('section', { class: 'section' }, h('h2', {}, 'Produtos relacionados'), h('div', { class: 'grid-products' }, rel.data.map(MP.productCard))) : null);
  } catch (e) { mount(root, e.status === 404 ? h('div', { class: 'empty' }, h('h2', {}, 'Produto não encontrado'), h('a', { class: 'btn', href: '/loja/pages/catalogo.html' }, 'Ver catálogo')) : MP.errorBox(e)); }
})();
