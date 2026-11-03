const API = (() => {
  const store = k => localStorage.getItem(k);
  async function refresh() {
    const rt = store('sf_refresh'); if (!rt) return false;
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: rt }) });
      const j = await r.json(); if (!j.success) return false;
      localStorage.setItem('sf_token', j.data.access_token); localStorage.setItem('sf_refresh', j.data.refresh_token); return true;
    } catch { return false; }
  }
  function logoutLocal() { ['sf_token', 'sf_refresh', 'sf_user'].forEach(k => localStorage.removeItem(k)); location.href = '/login.html'; }
  async function request(path, { method = 'GET', body, query } = {}, retry = true) {
    const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '';
    const res = await fetch('/api' + path + qs, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + store('sf_token') },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 && retry) { if (await refresh()) return request(path, { method, body, query }, false); logoutLocal(); throw new Error('Session expired'); }
    let json; try { json = await res.json(); } catch { json = { success: false, message: 'Unexpected server response' }; }
    if (!json.success) {
      const e = new Error(json.errors ? json.errors.map(x => `${x.field}: ${x.message}`).join(', ') : json.message || 'Request failed');
      e.status = res.status; throw e;
    }
    return json;
  }
  return {
    request, logoutLocal,
    get: (p, q) => request(p, { query: q }),
    post: (p, b) => request(p, { method: 'POST', body: b }),
    put: (p, b) => request(p, { method: 'PUT', body: b }),
    del: p => request(p, { method: 'DELETE' }),
    user: () => JSON.parse(store('sf_user') || 'null')
  };
})();
