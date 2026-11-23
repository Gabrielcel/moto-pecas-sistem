(function () {
  const { h, mount, brl, api } = MP; const { table, errorBox } = MP.kit;
  MP.views.dashboard = { title: 'Painel', perm: null, async render(root) {
    const me = MP.me; const can = (p) => me.is_admin || me.permissions.includes(p);
    if (!can('reports.view')) return mount(root, h('div', { class: 'card' }, h('h2', {}, `Olá, ${me.name.split(' ')[0]}!`), h('p', {}, 'Use o menu lateral para acessar as áreas liberadas para o seu perfil.')));
    mount(root, h('div', { class: 'spinner' }));
    try {
      const { data: d } = await api.get('/reports/dashboard');
      const kpi = (v, l, c = '') => h('div', { class: `kpi ${c}` }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
      mount(root,
        h('div', { class: 'kpis' }, kpi(d.total_orders, 'Total de pedidos'), kpi(d.pending_orders, 'Aguardando confirmação', d.pending_orders ? 'warn' : ''), kpi(d.in_progress_orders, 'Em andamento'), kpi(d.completed_orders, 'Pedidos entregues', 'good'),
          kpi(brl(d.revenue), 'Faturamento total'), kpi(brl(d.revenue_month), 'Faturamento do mês'), kpi(d.products_count, `Produtos (${d.active_products} ativos)`), kpi(d.low_stock_count, 'Estoque baixo', d.low_stock_count ? 'bad' : '')),
        h('div', { class: 'detail-grid' },
          h('div', {}, h('h3', {}, '⏳ Pedidos aguardando confirmação'), table({ empty: 'Nenhum pedido pendente. 🎉', columns: [
            { label: 'Pedido', render: (r) => h('a', { href: `#/orders?open=${r.id}` }, `#${r.order_code}`) }, { label: 'Cliente', key: 'customer_name' }, { label: 'Total', num: true, render: (r) => brl(r.total) },
            { label: 'Reserva até', render: (r) => MP.dateTime(r.reservation_expires_at) }], rows: d.awaiting_orders })),
          h('div', {}, h('h3', {}, '📉 Estoque baixo'), table({ empty: 'Estoque em dia.', columns: [{ label: 'Produto', key: 'name' }, { label: 'Disponível', num: true, key: 'available_quantity' }, { label: 'Mínimo', num: true, key: 'minimum_quantity' }], rows: d.low_stock }))));
    } catch (e) { mount(root, errorBox(e)); }
  } };
})();
