/* Componentes reutilizáveis do painel: tabelas, formulários, checklist, abas. */
(function () {
  const { h, $, mount, brl, api, setLoading, showFieldErrors, toast } = MP;

  /** table({ columns:[{label, render(row)|key, cls, num}], rows, empty, rowClass }) */
  function table({ columns, rows, empty = 'Nenhum registro encontrado.', rowClass }) {
    if (!rows.length) return h('div', { class: 'empty card' }, empty);
    return h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, columns.map((c) => h('th', { class: c.num ? 'num' : '' }, c.label)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: rowClass ? rowClass(r) : '' }, columns.map((c) => h('td', { class: `${c.num ? 'num' : ''} ${c.cls || ''}` }, c.render ? c.render(r) : r[c.key] ?? '—')))))));
  }
  const yesNo = (v) => h('span', { class: `badge ${v ? 'green' : 'gray'}` }, v ? 'Ativo' : 'Inativo');

  /** Lista de checkboxes com busca. options:[{value,label,group?}] */
  function checklist({ options, selected = [], searchable = true, height }) {
    const sel = new Set(selected.map(String)); const boxes = []; let lastGroup;
    const list = h('div', { class: 'checklist', style: height ? `max-height:${height}px` : '' });
    options.forEach((o) => {
      if (o.group !== undefined && o.group !== lastGroup) { lastGroup = o.group; list.append(h('div', { class: 'grp', 'data-g': o.group }, o.group)); }
      const cb = h('input', { type: 'checkbox', value: o.value, checked: sel.has(String(o.value)) }); const row = h('label', { 'data-t': (o.label + ' ' + (o.group || '')).toLowerCase() }, cb, o.label);
      boxes.push({ cb, row, o }); list.append(row);
    });
    const search = searchable ? h('input', { type: 'search', placeholder: 'Filtrar…', 'aria-label': 'Filtrar', style: 'margin-bottom:6px', oninput: (e) => { const q = e.target.value.toLowerCase(); boxes.forEach((b) => b.row.classList.toggle('hidden', q && !b.row.dataset.t.includes(q))); } }) : null;
    return { el: h('div', {}, search, list), get: () => boxes.filter((b) => b.cb.checked).map((b) => b.o.value) };
  }

  /** Cria os controles a partir de fields. Retorna { el, collect() }. */
  function formFields(fields, values = {}) {
    const ctl = {};
    const els = fields.map((f) => {
      const v = values[f.name]; let input;
      if (f.type === 'select') input = h('select', { id: `f_${f.name}`, name: f.name, required: f.req }, f.allowEmpty ? h('option', { value: '' }, f.emptyLabel || '—') : null, f.options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(v ?? f.default ?? '') }, o.label)));
      else if (f.type === 'textarea') { input = h('textarea', { id: `f_${f.name}`, name: f.name, maxlength: f.max || 2000, required: f.req }); input.value = v ?? ''; }
      else if (f.type === 'checkbox') input = h('input', { id: `f_${f.name}`, type: 'checkbox', name: f.name, checked: v ?? f.default ?? false });
      else if (f.type === 'checklist') { const c = checklist({ options: f.options, selected: v || [] }); ctl[f.name] = c; input = c.el; }
      else if (f.type === 'datetime') input = h('input', { id: `f_${f.name}`, name: f.name, type: 'datetime-local', required: f.req, value: MP.toInputDateTime(v) });
      else input = h('input', { id: `f_${f.name}`, name: f.name, type: f.type || 'text', required: f.req, min: f.min, max: f.max, step: f.step, maxlength: f.maxlength, value: v ?? '', autocomplete: f.ac || 'off', placeholder: f.ph || '' });
      ctl[f.name] = ctl[f.name] || input;
      if (f.type === 'checkbox') return h('div', { class: `field${f.span ? ' span2' : ''}` }, h('label', { class: 'check' }, input, f.label));
      return h('div', { class: 'field', style: f.span ? 'grid-column:1/-1' : '' }, h('label', { for: `f_${f.name}` }, f.label + (f.req ? ' *' : '')), input, f.hint ? h('span', { class: 'hint' }, f.hint) : null);
    });
    const collect = () => {
      const out = {};
      fields.forEach((f) => { const c = ctl[f.name];
        if (f.type === 'checklist') out[f.name] = c.get().map((x) => (f.numeric === false ? x : Number(x)));
        else if (f.type === 'checkbox') out[f.name] = c.checked;
        else if (f.type === 'datetime') out[f.name] = MP.fromInputDateTime(c.value);
        else if (f.type === 'number') out[f.name] = c.value === '' ? (f.nullable ? null : undefined) : Number(c.value);
        else if (f.type === 'select') out[f.name] = c.value === '' ? (f.allowEmpty ? null : undefined) : (f.options.length && typeof f.options[0].value === 'number' ? Number(c.value) : c.value);
        else out[f.name] = c.value.trim() === '' ? (f.nullable ? null : f.type === 'password' ? undefined : '') : (f.type === 'password' ? c.value : c.value.trim());
      }); return out;
    };
    return { els, collect };
  }

  /** Modal de formulário. onSubmit(values) deve lançar erro em caso de falha (exibido no formulário). */
  function formModal({ title, fields, values, submitText = 'Salvar', wide, onSubmit, before }) {
    const fm = formFields(fields, values); const msg = h('div', { role: 'alert' });
    const form = h('form', { novalidate: true, class: 'grid-2', onsubmit: (e) => { e.preventDefault(); save.click(); } }, fm.els);
    const save = h('button', { class: 'btn', type: 'button', onclick: async () => {
      setLoading(save, true); mount(msg);
      try { await onSubmit(fm.collect()); m.close(); } catch (e) { mount(msg, h('div', { class: 'alert error' }, e.message)); showFieldErrors(form, e.details); }
      setLoading(save, false); } }, submitText);
    const m = MP.modal({ title, wide, body: [before, form, msg], footer: [h('button', { class: 'btn secondary', type: 'button', onclick: () => m.close() }, 'Cancelar'), save] });
    return m;
  }

  /** Abas simples. tabs:[{id,label,render(container)}] */
  function tabs(list, initial) {
    const body = h('div'); const bar = h('div', { class: 'tabs', role: 'tablist' });
    const show = (id) => { [...bar.children].forEach((b) => b.classList.toggle('on', b.dataset.id === id)); const t = list.find((x) => x.id === id); mount(body); t.render(body); };
    list.forEach((t) => bar.append(h('button', { role: 'tab', 'data-id': t.id, onclick: () => show(t.id) }, t.label)));
    show(initial || list[0].id); return h('div', {}, bar, body);
  }

  /** CRUD genérico para tabelas simples. */
  function crudView({ title, endpoint, columns, fields, defaults = {}, canEdit = true, listQuery = {}, deleteLabel = 'Remover' }) {
    return async (root) => {
      const draw = async () => {
        mount(root, h('div', { class: 'spinner' }));
        const { data } = await api.get(endpoint, { all: 1, ...listQuery });
        const form = (row) => formModal({ title: row ? `Editar — ${title}` : `Novo — ${title}`, fields: typeof fields === 'function' ? fields(data) : fields, values: row || defaults,
          onSubmit: async (v) => { if (row) await api.put(`${endpoint}/${row.id}`, v); else await api.post(endpoint, v); toast('Salvo com sucesso', 'success'); draw(); } });
        mount(root, h('div', { class: 'page-head' }, h('h2', {}, title), canEdit ? h('button', { class: 'btn', onclick: () => form(null) }, '+ Novo') : null),
          table({ columns: [...columns, { label: '', cls: 'nowrap right', render: (r) => canEdit ? h('div', { class: 'rowact' }, h('button', { class: 'btn secondary small', onclick: () => form(r) }, 'Editar'),
            h('button', { class: 'btn secondary small', onclick: async () => { if (!(await MP.confirmDialog('Remover este registro? Se estiver em uso, ele será apenas desativado.', { danger: true, okText: deleteLabel }))) return;
              try { const res = await api.del(`${endpoint}/${r.id}`); toast(res.data.deactivated ? 'Registro em uso: foi desativado' : 'Removido', 'success'); draw(); } catch (e) { toast(e.message, 'error'); } } }, '🗑')) : null }], rows: data }));
      };
      draw().catch((e) => mount(root, MP.errorBox ? MP.errorBox(e) : h('div', { class: 'alert error' }, e.message)));
    };
  }
  const errorBox = (e) => h('div', { class: 'alert error', role: 'alert' }, e.message || 'Erro ao carregar.');
  MP.kit = { table, yesNo, checklist, formFields, formModal, tabs, crudView, errorBox };
  MP.views = MP.views || {};
})();
