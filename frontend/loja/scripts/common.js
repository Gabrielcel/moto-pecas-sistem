/* Loja: carrinho (localStorage), cabeçalho, rodapé, card de produto. */
(function () {
  const { h, $, mount, brl, api, imgUrl } = window.MP; const MP = window.MP;

  // ---------------- Carrinho ----------------
  const KEY = 'mp_cart_v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
  const write = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) { /* modo privado */ } document.dispatchEvent(new CustomEvent('cart:change')); };
  MP.cart = {
    items: read,
    count: () => read().reduce((s, i) => s + i.qty, 0),
    subtotal: () => Math.round(read().reduce((s, i) => s + i.price * i.qty * 100, 0)) / 100,
    add(p, qty = 1) {
      const items = read(); const max = p.available_quantity ?? p.max ?? 999; const ex = items.find((i) => i.id === p.id);
      const next = Math.min((ex ? ex.qty : 0) + qty, max);
      if (next <= 0) return false;
      if (ex) { ex.qty = next; ex.price = p.final_price ?? p.price; ex.max = max; } else items.push({ id: p.id, name: p.name, price: p.final_price ?? p.price, image: p.image_url, qty: next, max });
      write(items); return true;
    },
    set(id, qty) { const items = read(); const i = items.find((x) => x.id === id); if (!i) return; i.qty = Math.max(1, Math.min(qty, i.max || 999)); write(items); },
    remove(id) { write(read().filter((i) => i.id !== id)); },
    clear() { write([]); },
  };

  // ---------------- Configurações da loja ----------------
  let settingsP;
  MP.settings = () => (settingsP = settingsP || api.get('/settings/public').then((r) => r.data).catch(() => ({ store_name: 'Moto Peças Sistem', store_phone: '', business_days: [1, 2, 3, 4, 5, 6], business_hours: { open: '08:00', close: '18:00' }, payment_methods: ['pix', 'dinheiro'] })));
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  MP.hoursText = (s) => { const d = s.business_days || []; const w = d.length ? `${DAYS[d[0]]} a ${DAYS[d[d.length - 1]]}` : ''; return `${w}, ${s.business_hours.open} às ${s.business_hours.close}`; };
  MP.waLink = (s, text) => `https://wa.me/${s.store_phone}?text=${encodeURIComponent(text)}`;

  // ---------------- Card de produto ----------------
  MP.productCard = function (p) {
    const url = `/loja/pages/produto.html?id=${p.id}`; const out = p.available_quantity <= 0;
    const promo = p.promo_price != null;
    const pct = promo ? Math.round((1 - p.promo_price / p.sale_price) * 100) : 0;
    const avail = out ? h('span', { class: 'avail none' }, 'Indisponível') : p.available_quantity <= 3 ? h('span', { class: 'avail low' }, `Últimas ${p.available_quantity} un.`) : h('span', { class: 'avail ok' }, 'Em estoque');
    return h('article', { class: 'pcard' },
      promo ? h('span', { class: 'badge red tag' }, `-${pct}%`) : null,
      h('a', { class: 'img', href: url, 'aria-label': p.name }, h('img', { src: imgUrl(p.image_url), alt: p.name, loading: 'lazy', width: 400, height: 400 })),
      h('div', { class: 'body' },
        p.brand_name ? h('span', { class: 'brand' }, p.brand_name) : null,
        h('a', { class: 'name', href: url }, p.name),
        p.reviews_count ? h('div', { class: 'small' }, MP.stars(p.avg_rating), ` (${p.reviews_count})`) : null,
        h('div', {}, promo ? h('div', { class: 'price-old' }, brl(p.sale_price)) : null, h('div', { class: 'price' }, brl(p.final_price))), avail),
      h('div', { class: 'foot' }, out ? h('a', { class: 'btn secondary block small', href: url }, 'Ver detalhes')
        : h('button', { class: 'btn block small', type: 'button', onclick: () => { if (MP.cart.add(p, 1)) MP.toast('Adicionado ao carrinho', 'success'); } }, '🛒 Adicionar')));
  };
  MP.skeletons = (n = 8) => Array.from({ length: n }, () => h('div', { class: 'skeleton', style: 'height:330px' }));

  // ---------------- Cabeçalho / rodapé ----------------
  async function renderChrome() {
    const s = await MP.settings();
    const open = s.is_open_now;
    const badge = h('span', { class: 'cart-badge', 'aria-live': 'polite' }, '0');
    const updateBadge = () => { const n = MP.cart.count(); badge.textContent = n; badge.classList.toggle('hidden', n === 0); badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); };
    const q = new URLSearchParams(location.search).get('q') || '';
    const nav = h('nav', { class: 'catnav', id: 'catnav', 'aria-label': 'Categorias' }, h('div', { class: 'container' }, h('a', { href: '/loja/pages/catalogo.html' }, 'Todas as peças'), h('a', { class: 'accent', href: '/loja/pages/catalogo.html?promo=1' }, '🔥 Ofertas')));
    const header = h('header', { class: 'site-header' },
      h('div', { class: 'topbar' }, h('div', { class: 'container' },
        h('span', {}, h('span', { class: `dot${open ? ' open' : ''}` }), open ? 'Aberto agora' : 'Fechado agora — pedidos continuam sendo recebidos', ` · ${MP.hoursText(s)}`),
        h('span', {}, '📍 Entregamos em Crato e Juazeiro do Norte'))),
      h('div', { class: 'header-main' },
        h('button', { class: 'icon-btn menu-toggle', 'aria-label': 'Abrir menu', 'aria-controls': 'catnav', onclick: () => nav.classList.toggle('open') }, '☰'),
        h('a', { class: 'logo', href: '/', 'aria-label': 'Moto Peças Sistem — início' }, h('img', { src: '/assets/images/logo.png', alt: 'Moto Peças Sistem', width: 150, height: 52 })),
        h('form', { class: 'search', role: 'search', action: '/loja/pages/catalogo.html' }, h('label', { class: 'sr-only', for: 'q' }, 'Buscar peças'),
          h('input', { id: 'q', name: 'q', type: 'search', value: q, placeholder: 'Busque por peça, referência ou modelo da moto (ex.: pastilha CG 160)', autocomplete: 'off' }), h('button', { class: 'btn', type: 'submit', 'aria-label': 'Buscar' }, '🔍')),
        h('a', { class: 'cart-link', href: '/loja/pages/carrinho.html', 'aria-label': 'Carrinho' }, '🛒', h('span', { class: 'txt' }, 'Carrinho'), badge)),
      nav);
    mount($('#app-header'), header); updateBadge(); document.addEventListener('cart:change', updateBadge);
    api.get('/categories').then((r) => { const c = $('.container', nav); const accent = c.lastChild; r.data.filter((x) => !x.parent_id).forEach((cat) => c.insertBefore(h('a', { href: `/loja/pages/catalogo.html?category_id=${cat.id}` }, cat.name), accent)); }).catch(() => {});

    mount($('#app-footer'), h('footer', { class: 'site-footer' }, h('div', { class: 'container' },
      h('div', { class: 'cols-f' },
        h('div', {}, h('img', { src: '/assets/images/logo-light.png', alt: s.store_name, width: 190, height: 66, style: 'height:66px;width:auto;margin-bottom:10px' }), h('p', {}, 'Qualidade, desempenho e confiança para sua motocicleta.'), h('p', { class: 'small' }, s.store_address)),
        h('div', {}, h('h4', {}, 'Institucional'), h('ul', {}, h('li', {}, h('a', { href: '/loja/pages/institucional.html#entrega' }, 'Entrega e frete')), h('li', {}, h('a', { href: '/loja/pages/institucional.html#pagamento' }, 'Formas de pagamento')), h('li', {}, h('a', { href: '/loja/pages/institucional.html#contato' }, 'Fale conosco')), h('li', {}, h('a', { href: '/loja/pages/acompanhar.html' }, 'Acompanhar pedido')))),
        h('div', {}, h('h4', {}, 'Atendimento'), h('p', { class: 'small' }, MP.hoursText(s)), s.store_phone ? h('a', { class: 'btn whatsapp small', href: MP.waLink(s, 'Olá! Gostaria de ajuda com uma peça.'), target: '_blank', rel: 'noopener' }, 'Chamar no WhatsApp') : null)),
      h('div', { class: 'copy' }, `© ${new Date().getFullYear()} ${s.store_name}. Todos os direitos reservados.`))));
    if (s.store_phone) { const a = h('a', { class: 'wa-float', href: MP.waLink(s, 'Olá! Gostaria de ajuda com uma peça.'), target: '_blank', rel: 'noopener', 'aria-label': 'Falar no WhatsApp' }, '💬 WhatsApp'); a.style.display = 'block'; document.body.append(a); }
  }
  MP.ready = renderChrome();
  MP.getParam = (k) => new URLSearchParams(location.search).get(k);
  MP.errorBox = (e) => h('div', { class: 'alert error', role: 'alert' }, e.message || 'Não foi possível carregar.');
})();
