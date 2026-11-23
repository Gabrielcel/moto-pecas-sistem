(async function () {
  const { h, $, mount, api } = MP; const root = $('#root');
  const NAV = [
    ['dashboard', '📊', 'Painel'], ['orders', '🧾', 'Pedidos', 'Operação'], ['inventory', '📦', 'Estoque'], ['customers', '👥', 'Clientes'],
    ['products', '🏷️', 'Produtos', 'Catálogo'], ['categories', '🗂️', 'Categorias'], ['brands', '🏭', 'Fabricantes'], ['motorcycles', '🏍️', 'Motocicletas'], ['promotions', '🔥', 'Promoções'], ['reviews', '⭐', 'Avaliações'],
    ['reports', '📈', 'Relatórios', 'Gestão'], ['users', '🔐', 'Usuários'], ['settings', '⚙️', 'Configurações'], ['audit', '🕵️', 'Auditoria'], ['profile', '🙍', 'Minha conta'],
  ];
  MP.onUnauthorized = () => { if (!location.pathname.includes('/pages/')) location.replace('/admin/pages/login.html'); };
  try { MP.me = (await api.get('/auth/me')).data; } catch (e) { return location.replace('/admin/pages/login.html'); }
  MP.can = (p) => !p || MP.me.is_admin || MP.me.permissions.includes(p);

  const content = h('div', { class: 'content', id: 'content' }); const title = h('h1', {}, ''); const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' });
  const pendingBadge = h('span', { class: 'count hidden' }, '0'); let lastPending = null;
  const nav = h('nav', { class: 'nav', 'aria-label': 'Menu principal' });
  NAV.forEach(([id, icon, label, section]) => { const v = MP.views[id]; if (!v || !MP.can(v.perm)) return; if (section) nav.append(h('div', { class: 'sec' }, section));
    nav.append(h('a', { href: `#/${id}`, 'data-id': id, onclick: () => sidebar.classList.remove('open') }, h('span', { 'aria-hidden': 'true' }, icon), label, id === 'orders' ? pendingBadge : null)); });
  mount(sidebar, h('div', { class: 'brand' }, h('img', { src: '/assets/images/logo-light.png', alt: 'Moto Peças Sistem' }), h('small', {}, 'Painel administrativo')), nav,
    h('div', { style: 'margin-top:auto;padding:12px 8px' }, h('a', { class: 'btn secondary small block', href: '/', target: '_blank', rel: 'noopener' }, '🛍️ Ver loja')));
  mount(root, h('div', { class: 'app' }, sidebar, h('div', { class: 'main' },
    h('header', { class: 'topbar-a' }, h('div', { class: 'row' }, h('button', { class: 'icon-btn menu-btn', 'aria-label': 'Menu', onclick: () => sidebar.classList.toggle('open') }, '☰'), title),
      h('div', { class: 'row' }, h('span', { class: 'small' }, `👤 ${MP.me.name}`), h('button', { class: 'btn secondary small', onclick: async () => { try { await api.post('/auth/logout', {}); } catch (_) {} location.href = '/admin/pages/login.html'; } }, 'Sair'))), content)));

  function route() {
    if (MP.onLeave) { MP.onLeave(); MP.onLeave = null; }
    const [path, qs] = location.hash.replace(/^#\/?/, '').split('?'); const id = path || 'dashboard'; const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const v = MP.views[id];
document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
    if (!v) { title.textContent = 'Não encontrado'; return mount(content, h('div', { class: 'empty card' }, 'Página não encontrada.')); }
    if (!MP.can(v.perm)) { title.textContent = 'Acesso negado'; return mount(content, h('div', { class: 'alert error' }, 'Você não tem permissão para acessar esta área.')); }
    title.textContent = v.title; document.title = `${v.title} — Painel Moto Peças Sistem`; mount(content);
    Promise.resolve(v.render(content, params)).catch((e) => mount(content, MP.kit.errorBox(e)));
  }
  window.addEventListener('hashchange', route); route();

  // aviso de novos pedidos aguardando confirmação
  if (MP.can('orders.view')) {
    const poll = async () => { try { const { meta } = await api.get('/orders', { awaiting: 1, limit: 1 }); const n = meta.total; pendingBadge.textContent = n; pendingBadge.classList.toggle('hidden', n === 0);
      if (lastPending !== null && n > lastPending) MP.toast(`🔔 Novo pedido aguardando confirmação! (${n} pendente${n > 1 ? 's' : ''})`, 'warn', 8000); lastPending = n; } catch (_) {} };
    poll(); setInterval(poll, 30000);
  }
})();
