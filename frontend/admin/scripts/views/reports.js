(function () {
  const { h, mount, brl, api } = MP; const { table, errorBox } = MP.kit;
  const iso = (d) => d.toISOString().slice(0, 10);
  MP.views.reports = { title: 'Relatórios', perm: 'reports.view', render(root) {
    const today = new Date(); const f = { from: iso(new Date(today.getTime() - 29 * 864e5)), to: iso(today), period: 'day' }; const out = h('div');
    const inp = (label, key, type = 'date') => h('div', { class: 'field' }, h('label', {}, label), h('input', { type, value: f[key], onchange: (e) => { f[key] = e.target.value; load(); } }));
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Relatórios comerciais e financeiros')), h('div', { class: 'filters-bar' }, inp('De', 'from'), inp('Até', 'to'),
      h('div', { class: 'field' }, h('label', {}, 'Agrupar por'), h('select', { onchange: (e) => { f.period = e.target.value; load(); } }, [['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês'], ['year', 'Ano']].map(([v, l]) => h('option', { value: v }, l))))),
      h('p', { class: 'small muted' }, 'Venda concluída = pedido entregue. Lucro bruto = receita dos itens − custo registrado no momento da venda (despesas e lucro líquido não fazem parte desta versão).'), out);
    async function load() {
      mount(out, h('div', { class: 'spinner' }));
      try {
        const [sum, sales, top, low, canc, pay] = (await Promise.all(['summary', 'sales', 'top-products', 'low-movement', 'cancelled', 'payment-methods'].map((p) => api.get(`/reports/${p}`, { ...f, limit: 10 })))).map((r) => r.data);
        const kpi = (v, l, c = '') => h('div', { class: `kpi ${c}` }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)); const max = Math.max(1, ...sales.map((s) => s.revenue_total));
        mount(out, h('div', { class: 'kpis' }, kpi(brl(sum.revenue_total), 'Faturamento (com frete)', 'good'), kpi(brl(sum.revenue_products), 'Receita de produtos'), kpi(brl(sum.gross_profit), 'Lucro bruto', 'good'), kpi(`${sum.margin_percent}%`, 'Margem bruta'),
          kpi(sum.completed_orders, 'Pedidos concluídos'), kpi(brl(sum.average_ticket), 'Ticket médio'), kpi(sum.cancelled_orders, 'Pedidos cancelados', sum.cancelled_orders ? 'warn' : '')),
          h('div', { class: 'card', style: 'margin-bottom:18px' }, h('h3', {}, 'Vendas por período'), sales.length ? h('div', { class: 'bars' }, sales.map((s) => h('div', { class: 'bar-row' }, h('span', {}, MP.date(s.period)), h('div', { class: 'bar' }, h('i', { style: `width:${(s.revenue_total / max) * 100}%` })), h('span', { class: 'right' }, `${brl(s.revenue_total)} · ${s.orders} ped.`)))) : h('p', { class: 'muted' }, 'Sem vendas no período.')),
          h('div', { class: 'detail-grid' },
            h('div', {}, h('h3', {}, '🏆 Mais vendidos'), table({ empty: 'Sem dados.', columns: [{ label: 'Produto', key: 'name' }, { label: 'Un.', num: true, key: 'units_sold' }, { label: 'Receita', num: true, render: (r) => brl(r.revenue) }, { label: 'Lucro', num: true, render: (r) => brl(r.gross_profit) }, { label: 'Margem', num: true, render: (r) => (r.margin_percent == null ? '—' : r.margin_percent + '%') }], rows: top })),
            h('div', {}, h('h3', {}, '🐢 Menor saída'), table({ columns: [{ label: 'Produto', key: 'name' }, { label: 'Un. vendidas', num: true, key: 'units_sold' }], rows: low }))),
          h('div', { class: 'detail-grid', style: 'margin-top:18px' },
            h('div', {}, h('h3', {}, '💳 Por forma de pagamento'), table({ empty: 'Sem pagamentos.', columns: [{ label: 'Forma', render: (r) => MP.PAYMENT[r.payment_method] }, { label: 'Pagamentos', num: true, key: 'payments' }, { label: 'Valor', num: true, render: (r) => brl(r.amount) }], rows: pay })),
            h('div', {}, h('h3', {}, '✕ Pedidos cancelados'), table({ empty: 'Nenhum cancelamento.', columns: [{ label: 'Pedido', render: (r) => `#${r.order_code}` }, { label: 'Cliente', key: 'customer_name' }, { label: 'Motivo', render: (r) => r.cancel_reason || '—' }, { label: 'Total', num: true, render: (r) => brl(r.total) }], rows: canc }))));
      } catch (e) { mount(out, errorBox(e)); }
    }
    load();
  } };
})();
