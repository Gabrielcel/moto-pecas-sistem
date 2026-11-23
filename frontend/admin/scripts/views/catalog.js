(function () {
  const { h, mount, api } = MP; const { crudView, yesNo, tabs } = MP.kit;

  MP.views.categories = { title: 'Categorias', perm: 'products.manage', render: crudView({ title: 'Categorias', endpoint: '/categories',
    columns: [{ label: 'Nome', key: 'name' }, { label: 'Categoria pai', render: (r) => r.parent_name || '—' }, { label: 'Descrição', render: (r) => r.description || '—' }, { label: 'Situação', render: (r) => yesNo(r.status) }],
    fields: (rows) => [{ name: 'name', label: 'Nome', req: true }, { name: 'parent_id', label: 'Categoria pai (subcategoria)', type: 'select', allowEmpty: true, emptyLabel: '— nenhuma (categoria principal) —', options: rows.filter((c) => !c.parent_id).map((c) => ({ value: c.id, label: c.name })) },
      { name: 'description', label: 'Descrição', type: 'textarea', nullable: true, span: true }, { name: 'status', label: 'Ativa (visível na loja)', type: 'checkbox', default: true }], defaults: { status: true } }) };

  MP.views.brands = { title: 'Fabricantes', perm: 'products.manage', render: crudView({ title: 'Fabricantes', endpoint: '/brands',
    columns: [{ label: 'Nome', key: 'name' }, { label: 'Situação', render: (r) => yesNo(r.status) }],
    fields: [{ name: 'name', label: 'Nome do fabricante', req: true }, { name: 'status', label: 'Ativo', type: 'checkbox', default: true }], defaults: { status: true } }) };

  MP.views.motorcycles = { title: 'Motocicletas', perm: 'products.manage', async render(root) {
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Motocicletas e compatibilidade'), h('span', { class: 'muted small' }, 'Marcas e modelos usados para vincular as peças compatíveis.')));
    const holder = h('div'); root.append(holder);
    const brandsRender = crudView({ title: 'Marcas de moto', endpoint: '/motorcycles/brands', columns: [{ label: 'Marca', key: 'name' }, { label: 'Situação', render: (r) => yesNo(r.status) }],
      fields: [{ name: 'name', label: 'Marca', req: true }, { name: 'status', label: 'Ativa', type: 'checkbox', default: true }], defaults: { status: true } });
    const brands = (await api.get('/motorcycles/brands', { all: 1 })).data;
    const modelsRender = crudView({ title: 'Modelos de moto', endpoint: '/motorcycles/models',
      columns: [{ label: 'Marca', key: 'brand_name' }, { label: 'Modelo', key: 'name' }, { label: 'Anos', render: (r) => (r.year_start ? `${r.year_start}${r.year_end ? '–' + r.year_end : '+'}` : '—') }, { label: 'Cilindrada', render: (r) => (r.engine_displacement ? `${r.engine_displacement} cc` : '—') }, { label: 'Situação', render: (r) => yesNo(r.status) }],
      fields: [{ name: 'brand_id', label: 'Marca', type: 'select', req: true, options: brands.map((b) => ({ value: b.id, label: b.name })) }, { name: 'name', label: 'Modelo', req: true },
        { name: 'year_start', label: 'Ano inicial', type: 'number', nullable: true }, { name: 'year_end', label: 'Ano final', type: 'number', nullable: true, hint: 'Vazio = ainda em produção' },
        { name: 'engine_displacement', label: 'Cilindrada (cc)', type: 'number', nullable: true }, { name: 'status', label: 'Ativo', type: 'checkbox', default: true }], defaults: { status: true } });
    mount(holder, tabs([{ id: 'models', label: 'Modelos', render: modelsRender }, { id: 'brands', label: 'Marcas', render: brandsRender }]));
  } };
})();
