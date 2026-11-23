(function () {
  const { h, mount, brl, api, toast, debounce } = MP; const { table, formModal, errorBox } = MP.kit;

  MP.views.customers = { title: 'Clientes', perm: 'customers.view', render(root) {
    const f = { page: 1, q: '' }; const out = h('div');
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Clientes'), h('span', { class: 'muted small' }, 'Dados coletados nos pedidos (LGPD: acesso restrito).')),
      h('div', { class: 'filters-bar' }, h('div', { class: 'field' }, h('label', {}, 'Buscar'), h('input', { type: 'search', placeholder: 'Nome, telefone ou e-mail', oninput: debounce((e) => { f.q = e.target.value; f.page = 1; load(); }) }))), out);
    async function load() {
      try { const { data, meta } = await api.get('/customers', { ...f, limit: 20 });
        mount(out, table({ columns: [{ label: 'Cliente', render: (c) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); detail(c.id); } }, h('b', {}, c.name)) }, { label: 'Telefone', key: 'phone' }, { label: 'E-mail', render: (c) => c.email || '—' },
          { label: 'Pedidos', num: true, key: 'orders_count' }, { label: 'Total comprado', num: true, render: (c) => brl(c.total_spent) }, { label: 'Último pedido', render: (c) => MP.dateTime(c.last_order_at) }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }
    async function detail(id) {
      const c = (await api.get(`/customers/${id}`)).data;
      MP.modal({ title: c.name, wide: true, body: [h('p', {}, `${c.phone}${c.email ? ' · ' + c.email : ''} · cliente desde ${MP.date(c.created_at)}`),
        h('h4', {}, 'Endereços'), c.addresses.length ? h('ul', {}, c.addresses.map((a) => h('li', {}, `${a.street}, ${a.number || 's/n'} — ${a.neighborhood || ''}, ${a.city}/${a.state}`))) : h('p', { class: 'muted' }, 'Nenhum.'),
        h('h4', {}, 'Pedidos'), table({ columns: [{ label: 'Pedido', render: (o) => h('a', { href: `#/orders?open=${o.id}`, onclick: () => document.querySelector('.modal-backdrop')?.remove() }, `#${o.order_code}`) }, { label: 'Data', render: (o) => MP.dateTime(o.created_at) }, { label: 'Status', render: (o) => MP.statusBadge(o.status) }, { label: 'Total', num: true, render: (o) => brl(o.total) }], rows: c.orders })] });
    }
    load();
  } };

  MP.views.promotions = { title: 'Promoções', perm: 'promotions.manage', async render(root) {
    const draw = async () => {
      const [{ data: list }, { data: prods }] = await Promise.all([api.get('/promotions'), api.get('/products', { limit: 100, sort: 'nome' })]);
      const form = (p) => formModal({ title: p ? 'Editar promoção' : 'Nova promoção', wide: true, submitText: 'Salvar promoção',
        fields: [{ name: 'name', label: 'Nome da promoção', req: true, span: true }, { name: 'discount_type', label: 'Tipo de desconto', type: 'select', options: [{ value: 'percentual', label: 'Percentual (%)' }, { value: 'fixo', label: 'Valor fixo (R$)' }] },
          { name: 'discount_value', label: 'Valor do desconto', type: 'number', step: '0.01', min: 0, req: true }, { name: 'start_at', label: 'Início', type: 'datetime', req: true }, { name: 'end_at', label: 'Término (encerra automaticamente)', type: 'datetime', req: true },
          { name: 'description', label: 'Descrição', type: 'textarea', nullable: true, span: true }, { name: 'status', label: 'Ativa', type: 'checkbox', default: true },
          { name: 'product_ids', label: 'Produtos da promoção', type: 'checklist', span: true, options: prods.map((x) => ({ value: x.id, label: `${x.name} — ${brl(x.sale_price)}` })) }],
        values: p ? { ...p, product_ids: p.products.map((x) => x.id) } : { discount_type: 'percentual', status: true, product_ids: [] },
        onSubmit: async (v) => { if (p) await api.put(`/promotions/${p.id}`, v); else await api.post('/promotions', v); toast('Promoção salva', 'success'); draw(); } });
      mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Promoções e descontos'), h('button', { class: 'btn', onclick: () => form(null) }, '+ Nova promoção')),
        h('div', { class: 'alert info' }, 'Se um produto estiver em mais de uma promoção ativa, vale o menor preço (as promoções não se acumulam).'),
        table({ columns: [{ label: 'Promoção', key: 'name' }, { label: 'Desconto', render: (p) => (p.discount_type === 'percentual' ? `${p.discount_value}%` : brl(p.discount_value)) }, { label: 'Período', render: (p) => `${MP.dateTime(p.start_at)} → ${MP.dateTime(p.end_at)}` }, { label: 'Produtos', num: true, render: (p) => p.products.length },
          { label: 'Situação', render: (p) => (p.is_active_now ? h('span', { class: 'badge green' }, 'Em vigor') : p.status ? (new Date(p.start_at) > new Date() ? h('span', { class: 'badge blue' }, 'Agendada') : h('span', { class: 'badge gray' }, 'Encerrada')) : h('span', { class: 'badge gray' }, 'Inativa')) },
          { label: '', cls: 'nowrap', render: (p) => h('div', { class: 'rowact' }, h('button', { class: 'btn secondary small', onclick: () => form(p) }, 'Editar'), h('button', { class: 'btn secondary small', onclick: async () => { if (await MP.confirmDialog('Remover esta promoção?', { danger: true, okText: 'Remover' })) { await api.del(`/promotions/${p.id}`); draw(); } } }, '🗑')) }], rows: list }));
    };
    draw().catch((e) => mount(root, errorBox(e)));
  } };

  MP.views.reviews = { title: 'Avaliações', perm: 'reviews.moderate', render(root) {
    const f = { page: 1, status: '' }; const out = h('div');
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Moderação de avaliações')), h('div', { class: 'filters-bar' }, h('div', { class: 'field' }, h('label', {}, 'Situação'), h('select', { onchange: (e) => { f.status = e.target.value; f.page = 1; load(); } }, [['', 'Todas'], ['publicada', 'Publicadas'], ['pendente', 'Pendentes'], ['oculta', 'Ocultas']].map(([v, l]) => h('option', { value: v }, l))))), out);
    async function load() {
      try { const { data, meta } = await api.get('/reviews', { ...f, limit: 15 });
        mount(out, table({ columns: [{ label: 'Produto', key: 'product_name' }, { label: 'Cliente', render: (r) => `${r.customer_name} (#${r.order_code})` }, { label: 'Nota', render: (r) => MP.stars(r.rating) }, { label: 'Comentário', render: (r) => r.comment || '—' }, { label: 'Data', render: (r) => MP.date(r.created_at) },
          { label: 'Situação', render: (r) => h('span', { class: `badge ${r.status === 'publicada' ? 'green' : r.status === 'oculta' ? 'red' : 'yellow'}` }, r.status) },
          { label: '', cls: 'nowrap', render: (r) => h('div', { class: 'rowact' }, r.status !== 'publicada' ? h('button', { class: 'btn small', onclick: () => set(r.id, 'publicada') }, 'Publicar') : null, r.status !== 'oculta' ? h('button', { class: 'btn secondary small', onclick: () => set(r.id, 'oculta') }, 'Ocultar') : null) }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }
    const set = async (id, status) => { await api.patch(`/reviews/${id}/status`, { status }); toast('Avaliação atualizada', 'success'); load(); };
    load();
  } };
})();
