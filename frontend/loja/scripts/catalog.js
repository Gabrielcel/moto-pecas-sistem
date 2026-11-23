(async function () {
  const { h, $, mount, api, debounce } = MP; await MP.ready;
  const KEYS = ['q', 'category_id', 'brand_id', 'moto_brand_id', 'moto_model_id', 'min_price', 'max_price', 'in_stock', 'promo', 'featured', 'sort', 'page'];
  const st = {}; const sp = new URLSearchParams(location.search); KEYS.forEach((k) => { if (sp.get(k)) st[k] = sp.get(k); });
  const [cats, brands, mbrands] = await Promise.all([api.get('/categories'), api.get('/brands'), api.get('/motorcycles/brands')]).then((r) => r.map((x) => x.data));

  const sync = () => { const q = new URLSearchParams(); KEYS.forEach((k) => st[k] && q.set(k, st[k])); history.replaceState(null, '', `${location.pathname}?${q}`); };
  const set = (k, v) => { if (v === '' || v == null || v === false) delete st[k]; else st[k] = v; if (k !== 'page') delete st.page; load(); };
  const sel = (name, opts, cur, onch, ph) => h('select', { name, 'aria-label': ph, onchange: (e) => onch(e.target.value) }, h('option', { value: '' }, ph), opts.map((o) => h('option', { value: o.id, selected: String(o.id) === String(cur) }, o.name)));

  async function renderFilters() {
    const models = st.moto_brand_id ? (await api.get('/motorcycles/models', { brand_id: st.moto_brand_id })).data : [];
    const top = cats.filter((c) => !c.parent_id);
    mount($('#filters'),
      h('div', { class: 'field' }, h('h3', {}, 'Categoria'), h('div', { class: 'stack', style: 'font-size:.92rem' },
        h('a', { href: '#', onclick: (e) => { e.preventDefault(); set('category_id', ''); renderFilters(); }, style: !st.category_id ? 'font-weight:700' : '' }, 'Todas'),
        top.map((c) => h('div', {}, h('a', { href: '#', style: String(c.id) === st.category_id ? 'font-weight:700' : '', onclick: (e) => { e.preventDefault(); set('category_id', c.id); renderFilters(); } }, c.name),
          cats.filter((s) => s.parent_id === c.id).map((s) => h('div', { style: 'margin-left:14px' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); set('category_id', s.id); renderFilters(); } }, s.name))))))),
      h('div', { class: 'field' }, h('h3', {}, 'Sua moto'), sel('moto_brand_id', mbrands, st.moto_brand_id, (v) => { delete st.moto_model_id; set('moto_brand_id', v); renderFilters(); }, 'Marca da moto'),
        st.moto_brand_id ? sel('moto_model_id', models, st.moto_model_id, (v) => set('moto_model_id', v), 'Modelo') : null),
      h('div', { class: 'field' }, h('h3', {}, 'Fabricante da peça'), sel('brand_id', brands, st.brand_id, (v) => set('brand_id', v), 'Todos')),
      h('div', { class: 'field' }, h('h3', {}, 'Preço'), h('div', { class: 'row', style: 'flex-wrap:nowrap' },
        h('input', { type: 'number', min: 0, placeholder: 'Mín', 'aria-label': 'Preço mínimo', value: st.min_price || '', onchange: (e) => set('min_price', e.target.value) }),
        h('input', { type: 'number', min: 0, placeholder: 'Máx', 'aria-label': 'Preço máximo', value: st.max_price || '', onchange: (e) => set('max_price', e.target.value) }))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.in_stock === '1', onchange: (e) => set('in_stock', e.target.checked ? '1' : '') }), 'Somente em estoque'),
      h('label', { class: 'check', style: 'margin-top:10px' }, h('input', { type: 'checkbox', checked: st.promo === '1', onchange: (e) => set('promo', e.target.checked ? '1' : '') }), 'Somente promoções'),
      h('button', { class: 'btn secondary block small', style: 'margin-top:16px', onclick: () => { KEYS.forEach((k) => k !== 'q' && delete st[k]); renderFilters(); load(); } }, 'Limpar filtros'));
  }

  let seq = 0;
  async function load() {
    sync(); const my = ++seq; mount($('#grid'), MP.skeletons(8));
    try {
      const { data, meta } = await api.get('/products', { ...st, limit: 12 }); if (my !== seq) return;
      const catName = st.category_id && (cats.find((c) => String(c.id) === st.category_id) || {}).name;
      mount($('#toolbar'),
        h('div', {}, h('h1', { style: 'margin:0;font-size:1.3rem' }, st.q ? `Resultados para “${st.q}”` : catName || 'Todas as peças'), h('span', { class: 'muted small' }, `${meta.total} produto(s)`)),
        h('div', { class: 'row' }, h('button', { class: 'btn secondary small', id: 'ftoggle', type: 'button', onclick: () => $('#filters').classList.toggle('open') }, '⚙ Filtros'),
          h('label', { class: 'sr-only', for: 'sort' }, 'Ordenar'),
          h('select', { id: 'sort', onchange: (e) => set('sort', e.target.value) }, [['recentes', 'Mais recentes'], ['vendidos', 'Mais vendidos'], ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['nome', 'Nome (A–Z)']].map(([v, l]) => h('option', { value: v, selected: (st.sort || 'recentes') === v }, l)))));
      mount($('#grid'), data.length ? data.map(MP.productCard) : h('div', { class: 'empty', style: 'grid-column:1/-1' }, h('p', {}, 'Nenhuma peça encontrada.'), h('p', { class: 'small' }, 'Tente outros termos, remova filtros ou chame a gente no WhatsApp — ajudamos a achar a peça certa.')));
      mount($('#pager'), MP.pager(meta, (p) => { set('page', String(p)); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
    } catch (e) { mount($('#grid'), MP.errorBox(e)); }
  }
  await renderFilters(); load();
  const hq = $('#q'); if (hq) hq.addEventListener('input', debounce(() => { /* busca do cabeçalho envia o formulário; aqui apenas mantém valor */ }, 300));
})();
