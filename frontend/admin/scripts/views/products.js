(function () {
  const { h, $, mount, brl, api, toast, debounce, imgUrl } = MP; const { table, formFields, checklist, errorBox } = MP.kit;

  MP.views.products = { title: 'Produtos', perm: 'products.manage', async render(root) {
    const f = { page: 1, q: '', status: '' };
    const [cats, brands, models] = await Promise.all([api.get('/categories', { all: 1 }), api.get('/brands', { all: 1 }), api.get('/motorcycles/models', { all: 1 })]).then((r) => r.map((x) => x.data));
    const out = h('div'); const bar = h('div', { class: 'filters-bar' },
      h('div', { class: 'field' }, h('label', {}, 'Buscar'), h('input', { type: 'search', placeholder: 'Nome, referência, moto…', oninput: debounce((e) => { f.q = e.target.value; f.page = 1; load(); }) })),
      h('div', { class: 'field' }, h('label', {}, 'Categoria'), h('select', { onchange: (e) => { f.category_id = e.target.value; f.page = 1; load(); } }, h('option', { value: '' }, 'Todas'), cats.map((c) => h('option', { value: c.id }, c.name)))),
      h('div', { class: 'field' }, h('label', {}, 'Situação'), h('select', { onchange: (e) => { f.status = e.target.value; f.page = 1; load(); } }, [['', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos']].map(([v, l]) => h('option', { value: v }, l)))));
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Produtos'), h('button', { class: 'btn', onclick: () => edit(null) }, '+ Novo produto')), bar, out);

    async function load() {
      try {
        const { data, meta } = await api.get('/products', { ...f, include_inactive: 1, limit: 15, sort: 'nome' });
        mount(out, table({ columns: [
          { label: '', render: (r) => h('img', { src: imgUrl(r.image_url), alt: '', width: 44, height: 44, style: 'object-fit:cover;border-radius:6px' }) },
          { label: 'Produto', render: (r) => h('div', {}, h('b', {}, r.name), h('div', { class: 'small muted' }, `${r.reference || 'sem ref.'} · ${r.category_name || 'sem categoria'}${r.is_featured ? ' · ⭐ destaque' : ''}`)) },
          { label: 'Venda', num: true, render: (r) => h('div', {}, brl(r.sale_price), r.promo_price != null ? h('div', { class: 'small', style: 'color:var(--red)' }, `promo ${brl(r.promo_price)}`) : null) }, { label: 'Custo', num: true, render: (r) => brl(r.purchase_cost) },
          { label: 'Disp.', num: true, render: (r) => h('span', { class: `badge ${r.available_quantity <= r.minimum_quantity ? 'red' : 'green'}` }, r.available_quantity) },
          { label: 'Situação', render: (r) => h('span', { class: `badge ${r.status === 'ativo' ? 'green' : 'gray'}` }, r.status) },
          { label: '', cls: 'nowrap', render: (r) => h('div', { class: 'rowact' }, h('button', { class: 'btn secondary small', onclick: () => edit(r.id) }, 'Editar'), r.status === 'ativo' ? h('button', { class: 'btn secondary small', title: 'Desativar', onclick: async () => { if (await MP.confirmDialog(`Desativar "${r.name}"? O histórico de vendas é preservado.`, { danger: true, okText: 'Desativar' })) { await api.del(`/products/${r.id}`); toast('Produto desativado', 'success'); load(); } } }, '⏸') : null) }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }

    async function edit(id) {
      const p = id ? (await api.get(`/products/${id}`)).data : null;
      const fields = [
        { name: 'name', label: 'Nome do produto', req: true, span: true }, { name: 'reference', label: 'Referência / código', nullable: true }, { name: 'brand_id', label: 'Fabricante', type: 'select', allowEmpty: true, options: brands.map((b) => ({ value: b.id, label: b.name })) },
        { name: 'category_id', label: 'Categoria', type: 'select', allowEmpty: true, options: cats.map((c) => ({ value: c.id, label: (c.parent_name ? c.parent_name + ' › ' : '') + c.name })) },
        { name: 'sale_price', label: 'Preço de venda (R$)', type: 'number', step: '0.01', min: 0, req: true }, { name: 'purchase_cost', label: 'Custo de aquisição (R$)', type: 'number', step: '0.01', min: 0, hint: 'Usado no lucro bruto. Alterações não afetam pedidos antigos.' },
        { name: 'minimum_quantity', label: 'Estoque mínimo', type: 'number', min: 0 }, ...(id ? [] : [{ name: 'initial_quantity', label: 'Quantidade inicial em estoque', type: 'number', min: 0 }]),
        { name: 'description', label: 'Descrição', type: 'textarea', nullable: true, span: true, max: 5000 },
        { name: 'status', label: 'Situação', type: 'select', options: [{ value: 'ativo', label: 'Ativo (visível na loja)' }, { value: 'inativo', label: 'Inativo' }] }, { name: 'is_featured', label: '⭐ Exibir em destaque na página inicial', type: 'checkbox' }];
      const fm = formFields(fields, p ? { ...p } : { status: 'ativo', minimum_quantity: 0, initial_quantity: 0, purchase_cost: 0 });
      const compat = checklist({ options: models.map((m) => ({ value: m.id, label: `${m.name}${m.year_start ? ` (${m.year_start}${m.year_end ? '–' + m.year_end : '+'})` : ''}`, group: m.brand_name })), selected: p ? p.compatibilities.map((c) => c.motorcycle_model_id) : [], height: 240 });
      const msg = h('div', { role: 'alert' }); const save = h('button', { class: 'btn', type: 'button' }, 'Salvar produto');
      const imgBox = h('div'); const drawImgs = (list) => mount(imgBox, h('div', { class: 'img-grid' }, list.map((im) => h('div', { class: `im${im.is_primary ? ' primary' : ''}` }, h('img', { src: imgUrl(im.image_url), alt: '' }),
        h('div', { class: 'acts' }, im.is_primary ? h('span', { class: 'badge blue' }, 'Principal') : h('button', { type: 'button', class: 'btn secondary small', onclick: async () => drawImgs((await api.patch(`/products/${id}/images/${im.id}`, { is_primary: true })).data) }, '★'),
          h('button', { type: 'button', class: 'btn secondary small', onclick: async () => { drawImgs((await api.del(`/products/${id}/images/${im.id}`)).data); } }, '🗑'))))));
      if (p) drawImgs(p.images.filter((i) => i.id));
      const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, onchange: async () => { const fd = new FormData(); [...file.files].forEach((x) => fd.append('images', x)); try { drawImgs((await api.upload(`/products/${id}/images`, fd)).data); toast('Imagens enviadas', 'success'); } catch (e) { toast(e.message, 'error'); } file.value = ''; } });
      const m = MP.modal({ title: p ? `Editar produto #${p.id}` : 'Novo produto', wide: true, body: [
        h('div', { class: 'grid-2' }, fm.els),
        h('h4', {}, '🏍️ Compatibilidade (modelos de moto)'), compat.el,
        h('h4', { style: 'margin-top:18px' }, '🖼️ Fotos'), p ? [imgBox, h('div', { class: 'field', style: 'margin-top:8px' }, h('label', {}, 'Adicionar fotos (JPG, PNG ou WebP · até 5 MB)'), file)] : h('p', { class: 'muted small' }, 'Salve o produto primeiro para enviar as fotos.'), msg],
        footer: [h('button', { class: 'btn secondary', type: 'button', onclick: () => m.close() }, 'Fechar'), save] });
      save.addEventListener('click', async () => {
        MP.setLoading(save, true); mount(msg);
        try { const body = { ...fm.collect(), compatibilities: compat.get().map((x) => ({ motorcycle_model_id: Number(x) })) };
          if (p) { await api.put(`/products/${id}`, body); toast('Produto atualizado', 'success'); m.close(); load(); }
          else { const created = (await api.post('/products', body)).data; toast('Produto criado — agora adicione as fotos', 'success'); m.close(); load(); edit(created.id); }
        } catch (e) { mount(msg, h('div', { class: 'alert error' }, e.message, e.details ? h('ul', {}, e.details.map((d) => h('li', {}, d.message))) : null)); }
        MP.setLoading(save, false);
      });
    }
    load();
  } };
})();
