(function () {
  const { h, $, mount, api, setLoading, showFieldErrors } = MP; const box = $('#box'); const page = box.dataset.page;
  const logo = h('img', { class: 'logo', src: '/assets/images/logo.png', alt: 'Moto Peças Sistem' });
  const msg = h('div', { role: 'alert' });
  const show = (type, text) => mount(msg, h('div', { class: `alert ${type}` }, text));
  const field = (label, name, type, ac) => h('div', { class: 'field' }, h('label', { for: name }, label), h('input', { id: name, name, type, required: true, autocomplete: ac }));
  const form = (title, intro, fields, btnText, onSubmit, links) => {
    const btn = h('button', { class: 'btn block', type: 'submit' }, btnText);
    const f = h('form', { novalidate: true, onsubmit: async (e) => { e.preventDefault(); setLoading(btn, true); mount(msg); try { await onSubmit(Object.fromEntries(new FormData(f))); } catch (err) { show('error', err.message); showFieldErrors(f, err.details); } setLoading(btn, false); } }, fields, msg, btn);
    mount(box, logo, h('h2', { class: 'center', style: 'font-size:1.2rem' }, title), intro ? h('p', { class: 'center muted small' }, intro) : null, f, h('p', { class: 'center small', style: 'margin:14px 0 0' }, links));
  };
  if (page === 'login') {
    api.get('/auth/me').then(() => { location.replace('/admin/index.html'); }).catch(() => {});
    form('Painel administrativo', 'Acesso restrito a funcionários autorizados.', [field('E-mail', 'email', 'email', 'username'), field('Senha', 'password', 'password', 'current-password')], 'Entrar',
      async (v) => { await api.post('/auth/login', v); location.href = '/admin/index.html'; }, h('a', { href: '/admin/pages/esqueci-senha.html' }, 'Esqueci minha senha'));
  } else if (page === 'esqueci-senha') {
    form('Recuperar senha', 'Informe seu e-mail e enviaremos um link para criar uma nova senha.', [field('E-mail', 'email', 'email', 'username')], 'Enviar link',
      async (v) => { const r = await api.post('/auth/forgot-password', v); show('success', r.data.message); }, h('a', { href: '/admin/pages/login.html' }, '← Voltar ao login'));
  } else {
    const token = (location.hash.match(/token=([\w-]+)/) || [])[1];
    form('Criar nova senha', 'Use ao menos 8 caracteres, com letras e números.', [field('Nova senha', 'new_password', 'password', 'new-password'), field('Confirmar senha', 'confirm', 'password', 'new-password')], 'Salvar senha',
      async (v) => { if (!token) throw new Error('Link inválido. Solicite uma nova recuperação.'); if (v.new_password !== v.confirm) throw new Error('As senhas não conferem.'); await api.post('/auth/reset-password', { token, new_password: v.new_password }); show('success', 'Senha alterada! Redirecionando…'); setTimeout(() => { location.href = '/admin/pages/login.html'; }, 1500); },
      h('a', { href: '/admin/pages/login.html' }, '← Voltar ao login'));
  }
})();
