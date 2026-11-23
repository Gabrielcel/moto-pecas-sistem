/* Cliente da API REST (/api/v1). Cookies de sessão + token CSRF para o painel. */
(function () {
  const MP = (window.MP = window.MP || {});
  class ApiError extends Error { constructor(status, message, code, details) { super(message); this.status = status; this.code = code; this.details = details; } }
  const base = () => window.MP_CONFIG.API_URL;
  const csrf = () => (document.cookie.split('; ').find((c) => c.startsWith('csrf_token=')) || '').split('=')[1] || '';

  async function request(method, path, { body, query, headers = {}, form } = {}) {
    let url = base() + path;
    if (query) { const q = new URLSearchParams(); Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.append(k, v); }); const s = q.toString(); if (s) url += '?' + s; }
    const opts = { method, credentials: 'include', headers: { ...headers } };
    if (method !== 'GET') opts.headers['X-CSRF-Token'] = csrf();
    if (form) opts.body = form; else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(url, opts); } catch (e) { throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.', 'network'); }
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) {
      const err = (json && json.error) || {};
      const e = new ApiError(res.status, err.message || 'Erro inesperado. Tente novamente.', err.code, err.details);
      if (res.status === 401 && MP.onUnauthorized) MP.onUnauthorized(e);
      throw e;
    }
    return { data: json.data, meta: json.meta };
  }
  MP.api = {
    get: (p, query, o) => request('GET', p, { query, ...o }), post: (p, body, o) => request('POST', p, { body, ...o }),
    put: (p, body) => request('PUT', p, { body }), patch: (p, body) => request('PATCH', p, { body }), del: (p) => request('DELETE', p),
    upload: (p, form) => request('POST', p, { form }), ApiError,
  };
})();
