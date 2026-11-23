(function () {
  const { h, mount, api, toast, debounce } = MP; const { table, tabs, formModal, errorBox } = MP.kit;
  const TYPE = { entrada: ['Entrada', 'green'], saida: ['Saída', 'red'], reserva: ['Reserva', 'yellow'], liberacao_reserva: ['Liberação', 'blue'], ajuste_positivo: ['Ajuste +', 'green'], ajuste_negativo: ['Ajuste −', 'red'] };

  MP.views.inventory = { title: 'Estoque', perm: 'inventory.manage', render(root) {
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Controle de estoque')), tabs([
      { id: 'stock', label: 'Posição atual', render: stock }, { id: 'moves', label: 'Histórico de movimentações', render: moves }]));
  } };

  function stock(box) {
    const f = { page: 1, search: '', low: '' }; const out = h('div');
    mount(box, h('div', { class: 'filters-bar' },
      h('div', { class: 'field' }, h('label', {}, 'Buscar'), h('input', { type: 'search', placeholder: 'Produto ou referência', oninput: debounce((e) => { f.search = e.target.value; f.page = 1; load(); }) })),
      h('label', { class: 'check', style: 'margin-bottom:6px' }, h('input', { type: 'checkbox', onchange: (e) => { f.low = e.target.checked ? '1' : ''; f.page = 1; load(); } }), 'Somente estoque baixo')), out);
    async function load() {
      try {
        const { data, meta } = await api.get('/inventory', { ...f, limit: 20 });
        mount(out, table({ columns: [{ label: 'Produto', render: (r) => h('div', {}, h('b', {}, r.name), h('div', { class: 'small muted' }, r.reference || '')) },
          { label: 'Físico', num: true, key: 'quantity' }, { label: 'Reservado', num: true, key: 'reserved_quantity' },
          { label: 'Disponível', num: true, render: (r) => h('span', { class: `badge ${r.is_low ? 'red' : 'green'}` }, r.available_quantity) }, { label: 'Mínimo', num: true, key: 'minimum_quantity' },
          { label: '', cls: 'nowrap', render: (r) => h('div', { class: 'rowact' }, h('button', { class: 'btn small', onclick: () => move(r) }, '± Movimentar'), h('button', { class: 'btn secondary small', onclick: () => minimum(r) }, 'Mínimo')) }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }
    function move(r) {
      formModal({ title: `Movimentar — ${r.name}`, before: h('p', { class: 'small muted' }, `Físico: ${r.quantity} · Reservado: ${r.reserved_quantity} · Disponível: ${r.available_quantity}`),
        fields: [{ name: 'movement_type', label: 'Tipo', type: 'select', req: true, options: [{ value: 'entrada', label: 'Entrada (compra/reposição)' }, { value: 'saida', label: 'Saída (venda no balcão, perda)' }, { value: 'ajuste_positivo', label: 'Ajuste positivo (inventário)' }, { value: 'ajuste_negativo', label: 'Ajuste negativo (inventário)' }] },
          { name: 'quantity', label: 'Quantidade', type: 'number', min: 1, req: true }, { name: 'reason', label: 'Motivo / observação (obrigatório em ajustes)', span: true, nullable: true }],
        values: { movement_type: 'entrada', quantity: 1 }, onSubmit: async (v) => { await api.post('/inventory/movements', { ...v, product_id: r.product_id, reason: v.reason || undefined }); toast('Movimentação registrada', 'success'); load(); } });
    }
    function minimum(r) { formModal({ title: `Estoque mínimo — ${r.name}`, fields: [{ name: 'minimum_quantity', label: 'Quantidade mínima', type: 'number', min: 0, req: true }], values: { minimum_quantity: r.minimum_quantity },
      onSubmit: async (v) => { await api.put(`/inventory/${r.product_id}/minimum`, v); toast('Mínimo atualizado', 'success'); load(); } }); }
    load();
  }

  function moves(box) {
    const f = { page: 1, type: '' }; const out = h('div');
    mount(box, h('div', { class: 'filters-bar' }, h('div', { class: 'field' }, h('label', {}, 'Tipo'), h('select', { onchange: (e) => { f.type = e.target.value; f.page = 1; load(); } }, h('option', { value: '' }, 'Todos'), Object.entries(TYPE).map(([k, [l]]) => h('option', { value: k }, l))))), out);
    async function load() {
      try { const { data, meta } = await api.get('/inventory/movements', { ...f, limit: 25 });
        mount(out, table({ columns: [{ label: 'Data', render: (r) => MP.dateTime(r.created_at) }, { label: 'Produto', key: 'product_name' }, { label: 'Tipo', render: (r) => h('span', { class: `badge ${TYPE[r.movement_type][1]}` }, TYPE[r.movement_type][0]) }, { label: 'Qtd', num: true, key: 'quantity' },
          { label: 'Pedido', render: (r) => (r.order_code ? `#${r.order_code}` : '—') }, { label: 'Responsável', render: (r) => r.user_name || 'Sistema' }, { label: 'Motivo', render: (r) => r.reason || '—' }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }
    load();
  }
})();
