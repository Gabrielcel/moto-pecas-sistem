(async function () {
  const { h, $, mount, brl, api } = MP; await MP.ready;
  mount($('#hero'), h('a', { href: '/loja/pages/catalogo.html', 'aria-label': 'Ver todas as peças' }, h('picture', {},
    h('source', { media: '(max-width: 700px)', srcset: '/assets/images/banner-mobile.jpg' }),
    h('img', { src: '/assets/images/banner.jpg', alt: 'Moto Peças Sistem — qualidade, desempenho e confiança para sua motocicleta', width: 2048, height: 768, fetchpriority: 'high' }))));
  mount($('#benefits'), h('div', { class: 'benefits' },
    [['🔒', 'Compra segura', 'Pedido registrado e acompanhado'], ['🚚', 'Entrega local', 'Crato e Juazeiro do Norte'], ['🎧', 'Suporte especializado', 'Atendimento pelo WhatsApp'], ['💳', 'Pague na entrega', 'Pix ou cartão']]
      .map(([i, t, d]) => h('div', { class: 'benefit' }, h('span', { class: 'ic' }, i), h('div', {}, h('b', {}, t), h('span', { class: 'muted small' }, d))))));
  const box = $('#home-sections'); mount(box, h('div', { class: 'grid-products', style: 'margin-top:24px' }, MP.skeletons(4)));
  try {
    const { data } = await api.get('/public/home');
    const ICON = { Motor: '⚙️', Freios: '🛑', 'Transmissão': '⛓️', 'Elétrica': '🔋', 'Suspensão': '🔧', 'Acessórios': '🪖' };
    const sec = (title, list, link) => list.length ? h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, title), link ? h('a', { href: link }, 'Ver todos ›') : null), h('div', { class: 'grid-products' }, list.map(MP.productCard))) : null;
    mount(box,
      h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', {}, 'Navegue por categoria')),
        h('div', { class: 'cats' }, data.categories.filter((c) => !c.parent_id).map((c) => h('a', { class: 'cat-tile', href: `/loja/pages/catalogo.html?category_id=${c.id}` }, h('span', { class: 'ic', 'aria-hidden': 'true' }, ICON[c.name] || '🏍️'), c.name, h('small', {}, `${c.products_count} produtos`))))),
      sec('🔥 Promoções', data.promotions, '/loja/pages/catalogo.html?promo=1'), sec('Destaques', data.featured, '/loja/pages/catalogo.html?featured=1'),
      sec('Novidades', data.newest, '/loja/pages/catalogo.html?sort=recentes'), sec('Mais vendidos', data.bestsellers, '/loja/pages/catalogo.html?sort=vendidos'));
    if (!data.newest.length) mount(box, h('div', { class: 'empty' }, 'O catálogo está sendo preparado. Volte em breve!'));
  } catch (e) { mount(box, MP.errorBox(e)); }
})();
