(function () {
  const { h, mount, brl, api, toast, debounce } = MP; const { table, tabs, formModal, formFields, checklist, crudView, yesNo, errorBox } = MP.kit;

  // ---------------- Usuários e funções ----------------
  MP.views.users = { title: 'Usuários', perm: 'users.manage', render(root) {
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Usuários e permissões')), tabs([{ id: 'users', label: 'Usuários', render: usersTab }, { id: 'roles', label: 'Funções e permissões', render: rolesTab }]));
  } };

  async function usersTab(box) {
    const draw = async () => {
      const [{ data: users }, { data: roles }] = await Promise.all([api.get('/users'), api.get('/roles')]);
      const roleOpts = roles.map((r) => ({ value: r.id, label: r.name }));
      const edit = (u) => formModal({ title: u ? `Editar — ${u.name}` : 'Novo usuário', fields: [{ name: 'name', label: 'Nome', req: true, span: true }, { name: 'email', label: 'E-mail', type: 'email', req: true, span: true },
        ...(u ? [] : [{ name: 'password', label: 'Senha inicial', type: 'password', req: true, hint: 'Mín. 8 caracteres, com letras e números.', ac: 'new-password', span: true }]),
        { name: 'role_ids', label: 'Funções', type: 'checklist', options: roleOpts, span: true }], values: u ? { ...u, role_ids: u.roles.map((r) => r.id) } : { role_ids: [] },
        onSubmit: async (v) => { if (u) await api.put(`/users/${u.id}`, { name: v.name, email: v.email, role_ids: v.role_ids }); else await api.post('/users', v); toast('Usuário salvo', 'success'); draw(); } });
      const resetPw = (u) => formModal({ title: `Nova senha — ${u.name}`, fields: [{ name: 'password', label: 'Nova senha', type: 'password', req: true, ac: 'new-password' }], onSubmit: async (v) => { await api.post(`/users/${u.id}/reset-password`, v); toast('Senha redefinida; sessões encerradas', 'success'); } });
      mount(box, h('div', { class: 'row between', style: 'margin-bottom:12px' }, h('span', { class: 'muted small' }, 'Somente administradores criam contas e definem permissões.'), h('button', { class: 'btn', onclick: () => edit(null) }, '+ Novo usuário')),
        table({ columns: [{ label: 'Nome', render: (u) => h('div', {}, h('b', {}, u.name), h('div', { class: 'small muted' }, u.email)) }, { label: 'Funções', render: (u) => u.roles.map((r) => h('span', { class: 'badge blue', style: 'margin-right:4px' }, r.name)) },
          { label: 'Último acesso', render: (u) => MP.dateTime(u.last_login_at) }, { label: 'Situação', render: (u) => h('span', { class: `badge ${u.status === 'ativo' ? 'green' : 'red'}` }, u.status) },
          { label: '', cls: 'nowrap', render: (u) => h('div', { class: 'rowact' }, h('button', { class: 'btn secondary small', onclick: () => edit(u) }, 'Editar'), h('button', { class: 'btn secondary small', onclick: () => resetPw(u) }, '🔑'),
            h('button', { class: 'btn secondary small', onclick: async () => { const block = u.status === 'ativo'; if (!(await MP.confirmDialog(`${block ? 'Bloquear' : 'Reativar'} ${u.name}?`, { danger: block, okText: block ? 'Bloquear' : 'Reativar' }))) return; try { await api.patch(`/users/${u.id}/status`, { status: block ? 'bloqueado' : 'ativo' }); toast('Situação atualizada', 'success'); draw(); } catch (e) { toast(e.message, 'error'); } } }, u.status === 'ativo' ? '⛔ Bloquear' : '✅ Reativar')) }], rows: users }));
    };
    draw().catch((e) => mount(box, errorBox(e)));
  }

  async function rolesTab(box) {
    const draw = async () => {
      const [{ data: roles }, { data: perms }] = await Promise.all([api.get('/roles'), api.get('/permissions')]);
      const edit = (r) => formModal({ title: r ? `Função — ${r.name}` : 'Nova função', wide: true, fields: [{ name: 'name', label: 'Nome da função', req: true }, { name: 'description', label: 'Descrição', nullable: true },
        { name: 'permission_ids', label: 'Permissões', type: 'checklist', span: true, options: perms.map((p) => ({ value: p.id, label: `${p.name} — ${p.description}` })) }],
        values: r ? { ...r } : { permission_ids: [] }, onSubmit: async (v) => { if (r) await api.put(`/roles/${r.id}`, v); else await api.post('/roles', v); toast('Função salva', 'success'); draw(); } });
      mount(box, h('div', { class: 'row between', style: 'margin-bottom:12px' }, h('span', { class: 'muted small' }, 'Alterar permissões de uma função encerra as sessões dos usuários vinculados ao reentrarem.'), h('button', { class: 'btn', onclick: () => edit(null) }, '+ Nova função')),
        table({ columns: [{ label: 'Função', render: (r) => h('div', {}, h('b', {}, r.name), h('div', { class: 'small muted' }, r.description || '')) }, { label: 'Permissões', render: (r) => r.name === 'Administrador' ? h('span', { class: 'badge green' }, 'Acesso completo') : r.permission_ids.length ? `${r.permission_ids.length} permissão(ões)` : '—' }, { label: 'Usuários', num: true, key: 'users_count' },
          { label: '', cls: 'nowrap', render: (r) => h('div', { class: 'rowact' }, h('button', { class: 'btn secondary small', onclick: () => edit(r) }, 'Editar'), r.name !== 'Administrador' ? h('button', { class: 'btn secondary small', onclick: async () => { if (await MP.confirmDialog(`Remover a função ${r.name}?`, { danger: true, okText: 'Remover' })) { try { await api.del(`/roles/${r.id}`); draw(); } catch (e) { toast(e.message, 'error'); } } } }, '🗑') : null) }], rows: roles }));
    };
    draw().catch((e) => mount(box, errorBox(e)));
  }

  // ---------------- Configurações ----------------
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  MP.views.settings = { title: 'Configurações', perm: 'settings.manage', render(root) {
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Configurações da loja')), tabs([{ id: 'store', label: 'Loja e atendimento', render: storeTab }, { id: 'delivery', label: 'Frete', render: deliveryTab }, { id: 'regions', label: 'Regiões atendidas', render: regionsTab }]));
  } };

  async function storeTab(box) {
    const s = (await api.get('/settings')).data;
    const days = checklist({ options: DAYS.map((d, i) => ({ value: i, label: d })), selected: s.business_days, searchable: false });
    const pays = checklist({ options: Object.entries(MP.PAYMENT).map(([v, l]) => ({ value: v, label: l })), selected: s.payment_methods, searchable: false });
    const fm = formFields([{ name: 'store_name', label: 'Nome da loja', req: true }, { name: 'store_phone', label: 'WhatsApp da loja (só dígitos, com 55)', req: true, hint: 'Ex.: 5588999999999 — destino da mensagem do pedido.' }, { name: 'store_email', label: 'E-mail', type: 'email' }, { name: 'store_address', label: 'Endereço de origem' },
      { name: 'store_latitude', label: 'Latitude da loja', type: 'number', step: 'any', hint: 'Origem do cálculo de frete.' }, { name: 'store_longitude', label: 'Longitude da loja', type: 'number', step: 'any' }, { name: 'open', label: 'Abre às', type: 'time' }, { name: 'close', label: 'Fecha às', type: 'time' },
      { name: 'reservation_minutes', label: 'Prazo da reserva (minutos)', type: 'number', min: 5, hint: 'Pedidos fora do horário contam a partir da abertura.' }, { name: 'contact_info', label: 'Texto de contato', type: 'textarea', span: true },
      { name: 'accept_delivery', label: 'Aceitar entregas', type: 'checkbox' }, { name: 'accept_pickup', label: 'Aceitar retirada na loja', type: 'checkbox' }, { name: 'reviews_require_approval', label: 'Avaliações exigem aprovação antes de publicar', type: 'checkbox' }],
      { ...s, open: s.business_hours.open, close: s.business_hours.close });
    const msg = h('div');
    mount(box, h('div', { class: 'card' }, h('div', { class: 'grid-2' }, fm.els), h('div', { class: 'field' }, h('label', {}, 'Dias de funcionamento'), days.el), h('div', { class: 'field' }, h('label', {}, 'Formas de pagamento aceitas na entrega'), pays.el), msg,
      h('button', { class: 'btn', onclick: async (e) => { const v = fm.collect(); MP.setLoading(e.currentTarget, true); try { await api.put('/settings', { store_name: v.store_name, store_phone: v.store_phone, store_email: v.store_email, store_address: v.store_address, store_latitude: v.store_latitude, store_longitude: v.store_longitude,
        contact_info: v.contact_info, reservation_minutes: v.reservation_minutes, accept_delivery: v.accept_delivery, accept_pickup: v.accept_pickup, reviews_require_approval: v.reviews_require_approval, business_days: days.get().map(Number).sort(), business_hours: { open: v.open, close: v.close }, payment_methods: pays.get() }); toast('Configurações salvas', 'success'); mount(msg); } catch (err) { mount(msg, h('div', { class: 'alert error' }, err.message, err.details ? h('ul', {}, err.details.map((d) => h('li', {}, `${d.field}: ${d.message}`))) : null)); } MP.setLoading(e.currentTarget, false); } }, 'Salvar configurações')));
  }
  async function deliveryTab(box) {
    const s = (await api.get('/settings')).data;
    const fm = formFields([{ name: 'freight_base', label: 'Taxa base (R$)', type: 'number', step: '0.01', min: 0 }, { name: 'freight_per_km', label: 'Valor por km rodado (R$)', type: 'number', step: '0.01', min: 0 }, { name: 'freight_min', label: 'Frete mínimo (R$)', type: 'number', step: '0.01', min: 0 }], s);
    mount(box, h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Frete estimado = máx(frete mínimo, taxa base + valor por km × distância da rota). O valor final pode ser ajustado em cada pedido.'), h('div', { class: 'grid-3' }, fm.els),
      h('button', { class: 'btn', onclick: async () => { try { await api.put('/settings', fm.collect()); toast('Tarifas salvas', 'success'); } catch (e) { toast(e.message, 'error'); } } }, 'Salvar tarifas')));
  }
  function regionsTab(box) {
    return crudView({ title: 'Regiões de entrega', endpoint: '/delivery/regions', columns: [{ label: 'Cidade', key: 'city' }, { label: 'UF', key: 'state' }, { label: 'Situação', render: (r) => yesNo(r.status) }],
      fields: [{ name: 'city', label: 'Cidade', req: true }, { name: 'state', label: 'UF', req: true, maxlength: 2, ph: 'CE' }, { name: 'status', label: 'Atendida (aceita entregas)', type: 'checkbox', default: true }], defaults: { status: true, state: 'CE' } })(box);
  }

  // ---------------- Auditoria ----------------
  MP.views.audit = { title: 'Auditoria', perm: 'audit.view', render(root) {
    const f = { page: 1, action: '' }; const out = h('div');
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Histórico de atividades'), h('span', { class: 'muted small' }, 'Registros imutáveis das ações administrativas.')),
      h('div', { class: 'filters-bar' }, h('div', { class: 'field' }, h('label', {}, 'Ação'), h('input', { type: 'search', placeholder: 'ex.: pedido, estoque, usuario', oninput: debounce((e) => { f.action = e.target.value; f.page = 1; load(); }) }))), out);
    async function load() {
      try { const { data, meta } = await api.get('/audit', { ...f, limit: 30 });
        mount(out, table({ columns: [{ label: 'Data', cls: 'nowrap', render: (r) => MP.dateTime(r.created_at) }, { label: 'Usuário', render: (r) => r.user_name || 'Sistema' }, { label: 'Ação', render: (r) => h('span', { class: 'badge blue' }, r.action) }, { label: 'Entidade', render: (r) => (r.entity_type ? `${r.entity_type} #${r.entity_id || ''}` : '—') },
          { label: 'Detalhes', render: (r) => h('code', { class: 'small', style: 'word-break:break-all' }, r.new_values ? JSON.stringify(r.new_values).slice(0, 140) : '') }, { label: 'IP', render: (r) => r.ip_address || '—' }], rows: data }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { mount(out, errorBox(e)); }
    }
    load();
  } };

  // ---------------- Minha conta ----------------
  MP.views.profile = { title: 'Minha conta', perm: null, render(root) {
    const fm = formFields([{ name: 'current_password', label: 'Senha atual', type: 'password', req: true, ac: 'current-password' }, { name: 'new_password', label: 'Nova senha', type: 'password', req: true, ac: 'new-password', hint: 'Mín. 8 caracteres, com letras e números.' }, { name: 'confirm', label: 'Confirmar nova senha', type: 'password', req: true, ac: 'new-password' }]); const msg = h('div');
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Minha conta')), h('div', { class: 'card', style: 'max-width:480px' }, h('p', {}, h('b', {}, MP.me.name), h('br'), MP.me.email, h('br'), MP.me.roles.map((r) => h('span', { class: 'badge blue' }, r))), h('h3', {}, 'Alterar senha'), fm.els, msg,
      h('button', { class: 'btn', onclick: async () => { const v = fm.collect(); if (v.new_password !== v.confirm) return mount(msg, h('div', { class: 'alert error' }, 'As senhas não conferem.')); try { await api.post('/auth/change-password', { current_password: v.current_password, new_password: v.new_password }); toast('Senha alterada', 'success'); mount(msg, h('div', { class: 'alert success' }, 'Senha alterada. Outras sessões foram encerradas.')); } catch (e) { mount(msg, h('div', { class: 'alert error' }, e.message)); } } }, 'Alterar senha')));
  } };
})();
