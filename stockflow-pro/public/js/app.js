// Core: layout, router, permissions and shared UI helpers.
const Views = {};
const PERMS = {
  admin: ['*'],
  warehouse_manager: ['dashboard','products','warehouses','inventory','transfers','purchases','suppliers','barcodes','returns','reports','notifications','categories','brands'],
  inventory_staff: ['dashboard','products','inventory','transfers','barcodes','categories','brands','notifications','warehouses:read'],
  sales_staff: ['dashboard','sales','customers','barcodes','returns','notifications','products:read','inventory:read','warehouses:read']
};
const MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', perm: 'dashboard' },
  { key: 'products', label: 'Products', icon: 'package', perm: 'products' },
  { key: 'warehouses', label: 'Warehouses', icon: 'warehouse', perm: 'warehouses' },
  { key: 'inventory', label: 'Inventory', icon: 'boxes', perm: 'inventory' },
  { key: 'purchases', label: 'Purchases', icon: 'shopping-cart', perm: 'purchases' },
  { key: 'suppliers', label: 'Suppliers', icon: 'truck', perm: 'suppliers' },
  { key: 'sales', label: 'Sales', icon: 'receipt', perm: 'sales' },
  { key: 'customers', label: 'Customers', icon: 'users', perm: 'customers' },
  { key: 'barcode-returns', label: 'Barcode & Returns', icon: 'scan-barcode', perm: 'barcodes' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-3', perm: 'reports' },
  { key: 'employees', label: 'Employees & Users', icon: 'user-cog', perm: 'employees' },
  { key: 'settings', label: 'Settings', icon: 'settings', perm: 'settings' }
];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const icons = () => window.lucide && lucide.createIcons();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => 'Rs ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = n => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 3 });
const fmtDate = d => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: String(d).length > 10 ? 'short' : undefined }) : '-';
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const grants = () => PERMS[API.user()?.role] || [];
const canRead = p => { const g = grants(); return g.includes('*') || g.includes(p) || g.includes(p + ':read'); };
const canWrite = p => { const g = grants(); return g.includes('*') || g.includes(p); };
const badge = (text, kind = 'gray') => `<span class="badge b-${kind}">${esc(text)}</span>`;
const statusBadge = s => badge(s, { active: 'green', inactive: 'gray', completed: 'green', received: 'green', approved: 'blue', pending: 'amber', draft: 'gray', cancelled: 'red' }[s] || 'gray');

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast'; el.style.background = type === 'error' ? '#dc2626' : '#16a34a'; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), type === 'error' ? 5000 : 3000);
}

function modal({ title, body, size = 'max-w-lg', onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4';
  wrap.innerHTML = `<div class="bg-white rounded-2xl w-full ${size} max-h-[90vh] overflow-auto shadow-2xl fade">
    <div class="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10"><h3 class="font-bold text-lg">${esc(title)}</h3>
    <button data-close class="icon-btn"><i data-lucide="x" class="w-5 h-5"></i></button></div><div class="p-5">${body}</div></div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  $('[data-close]', wrap).onclick = close;
  icons(); onMount && onMount(wrap, close);
  return { el: wrap, close };
}

function confirmBox(message, okText = 'Delete') {
  return new Promise(res => {
    const m = modal({ title: 'Please confirm', size: 'max-w-sm', body: `<p class="text-sm text-slate-600 mb-5">${esc(message)}</p>
      <div class="flex justify-end gap-2"><button data-no class="btn btn-ghost">Cancel</button><button data-yes class="btn btn-danger">${esc(okText)}</button></div>`,
      onMount: (w) => { $('[data-no]', w).onclick = () => { m.close(); res(false); }; $('[data-yes]', w).onclick = () => { m.close(); res(true); }; } });
  });
}

function promptCreate(title, label, endpoint, done) {
  modal({ title, size: 'max-w-sm', body: `<form class="space-y-4"><div><label class="lbl">${esc(label)}</label><input name="name" required class="input" autofocus></div><p data-err class="text-sm text-red-600 hidden"></p><button class="btn btn-primary w-full justify-center">Create</button></form>`,
    onMount: (w, close) => { $('form', w).onsubmit = async e => { e.preventDefault(); try { await API.post(endpoint, formToObject(e.target)); toast('Created successfully'); close(); done(); } catch (x) { const p = $('[data-err]', w); p.textContent = x.message; p.classList.remove('hidden'); } }; } });
}
function skeleton(rows = 6) { return `<div class="p-4 space-y-3">${Array.from({ length: rows }, () => '<div class="skeleton h-9"></div>').join('')}</div>`; }
function emptyState(title, text = '') { return `<div class="py-14 text-center text-slate-500"><i data-lucide="inbox" class="w-10 h-10 mx-auto mb-3 text-slate-300"></i><div class="font-semibold text-slate-700">${esc(title)}</div><div class="text-sm">${esc(text)}</div></div>`; }
function errorState(msg) { return `<div class="py-14 text-center"><i data-lucide="alert-triangle" class="w-10 h-10 mx-auto mb-3 text-red-400"></i><div class="font-semibold text-red-600">Something went wrong</div><div class="text-sm text-slate-500 mb-3">${esc(msg)}</div><button data-retry class="btn btn-ghost">Retry</button></div>`; }
function pager(meta) {
  if (!meta || meta.pages <= 1) return meta ? `<div class="px-4 py-3 text-xs text-slate-500 border-t">${meta.total} record(s)</div>` : '';
  return `<div class="px-4 py-3 border-t flex items-center justify-between text-sm"><span class="text-slate-500 text-xs">${meta.total} records &middot; page ${meta.page} of ${meta.pages}</span>
    <div class="flex gap-2"><button data-page="${meta.page - 1}" class="btn btn-ghost" ${meta.page <= 1 ? 'disabled' : ''}>Previous</button><button data-page="${meta.page + 1}" class="btn btn-ghost" ${meta.page >= meta.pages ? 'disabled' : ''}>Next</button></div></div>`;
}
function formToObject(form) {
  const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' && v.trim() === '' ? null : v; });
  return o;
}
function pageHeader(title, subtitle, actionHtml = '') {
  return `<div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h1 class="text-2xl font-bold">${esc(title)}</h1><p class="text-sm text-slate-500">${esc(subtitle || '')}</p></div>${actionHtml}</div>`;
}

// Generic CRUD list view with search, filters, sorting, pagination, add/edit/delete modals.
function crudView(cfg) {
  return async function (el) {
    const st = { page: 1, search: '', filters: {}, sort: cfg.sort?.[0]?.value || 'created_at', order: cfg.sort?.[0]?.order || 'desc' };
    if (cfg.key === 'products' && window.__globalSearch) { st.search = window.__globalSearch; window.__globalSearch = ''; }
    const write = canWrite(cfg.module);
    const opts = {};
    const optFields = [...(cfg.filters || []), ...cfg.fields.filter(f => f.options)];
    try { await Promise.all(optFields.map(async f => { if (!opts[f.name]) opts[f.name] = await f.options(); })); } catch (e) { toast(e.message, 'error'); }

    el.innerHTML = pageHeader(cfg.title, cfg.subtitle, write ? `<div class="flex gap-2">${(cfg.extraButtons || []).map((b, i) => `<button data-extra="${i}" class="btn btn-ghost">${esc(b.label)}</button>`).join('')}<button data-add class="btn btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Add ${esc(cfg.singular)}</button></div>` : '') + `
      <div class="card p-4 mb-4 flex flex-wrap gap-3">
        <div class="relative flex-1 min-w-[200px]"><i data-lucide="search" class="w-4 h-4 absolute left-3 top-3 text-slate-400"></i>
          <input data-search class="input pl-9" placeholder="Search ${esc(cfg.title.toLowerCase())}..." value="${esc(st.search)}"></div>
        ${(cfg.filters || []).map(f => `<select data-filter="${f.name}" class="input !w-auto"><option value="">${esc(f.label)}</option>${(opts[f.name] || []).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`).join('')}
        ${cfg.sort ? `<select data-sort class="input !w-auto">${cfg.sort.map((s, i) => `<option value="${i}">${esc(s.label)}</option>`).join('')}</select>` : ''}
      </div><div class="card overflow-hidden"><div data-table></div><div data-pager></div></div>`;
    icons();
    const tbl = $('[data-table]', el), pg = $('[data-pager]', el);
    let rows = [];

    async function load() {
      tbl.innerHTML = skeleton();
      try {
        const q = { page: st.page, limit: 10, search: st.search, sort: st.sort, order: st.order, ...st.filters };
        const r = await API.get(cfg.endpoint, q); rows = r.data;
        if (!rows.length) { tbl.innerHTML = emptyState(`No ${cfg.title.toLowerCase()} found`, st.search ? 'Try a different search.' : (write ? `Click "Add ${cfg.singular}" to create one.` : '')); pg.innerHTML = ''; icons(); return; }
        tbl.innerHTML = `<div class="overflow-x-auto"><table class="tbl"><thead><tr>${cfg.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}<th class="text-right">Actions</th></tr></thead><tbody>
          ${rows.map((r, i) => `<tr>${cfg.columns.map(c => `<td>${c.render(r)}</td>`).join('')}<td class="text-right whitespace-nowrap">
            ${cfg.detail ? `<button class="icon-btn" title="View" data-act="view" data-i="${i}"><i data-lucide="eye" class="w-4 h-4"></i></button>` : ''}
            ${write ? `<button class="icon-btn" title="Edit" data-act="edit" data-i="${i}"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="icon-btn del" title="Delete" data-act="del" data-i="${i}"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
          </td></tr>`).join('')}</tbody></table></div>`;
        pg.innerHTML = pager(r.meta); icons();
      } catch (e) { tbl.innerHTML = errorState(e.message); pg.innerHTML = ''; icons(); }
    }

    function fieldHtml(f, v) {
      const val = v ?? '';
      if (f.options) return `<select name="${f.name}" class="input" ${f.required ? 'required' : ''}><option value="">${f.required ? 'Select...' : 'None'}</option>${(opts[f.name] || []).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      if (f.type === 'select') return `<select name="${f.name}" class="input">${f.choices.map(c => `<option ${c === val ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
      if (f.type === 'textarea') return `<textarea name="${f.name}" rows="3" class="input">${esc(val)}</textarea>`;
      return `<input name="${f.name}" type="${f.type || 'text'}" ${f.step ? `step="${f.step}"` : ''} ${f.required ? 'required' : ''} value="${esc(val)}" class="input">`;
    }
    function openForm(row) {
      const editing = !!row;
      const fields = cfg.fields.filter(f => !(editing && f.createOnly));
      modal({
        title: `${editing ? 'Edit' : 'Add'} ${cfg.singular}`, size: 'max-w-2xl',
        body: `<form class="grid grid-cols-1 sm:grid-cols-2 gap-4">${fields.map(f => `<div class="${f.full ? 'sm:col-span-2' : ''}"><label class="lbl">${esc(f.label)}${f.required ? ' *' : ''}</label>${fieldHtml(f, row ? row[f.name] : f.default)}</div>`).join('')}
          <p data-err class="sm:col-span-2 text-sm text-red-600 hidden"></p>
          <div class="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" data-close2 class="btn btn-ghost">Cancel</button><button class="btn btn-primary">${editing ? 'Save changes' : 'Create'}</button></div></form>`,
        onMount: (w, close) => {
          $('[data-close2]', w).onclick = close;
          $('form', w).onsubmit = async e => {
            e.preventDefault(); const btn = $('button.btn-primary', w); btn.disabled = true;
            try {
              const body = formToObject(e.target);
              if (editing) await API.put(`${cfg.endpoint}/${row.id}`, body); else await API.post(cfg.endpoint, body);
              toast(editing ? 'Updated successfully' : 'Created successfully'); close(); load();
            } catch (x) { const p = $('[data-err]', w); p.textContent = x.message; p.classList.remove('hidden'); btn.disabled = false; }
          };
        }
      });
    }

    el.addEventListener('click', async e => {
      const t = e.target.closest('[data-act],[data-add],[data-page],[data-retry],[data-extra]'); if (!t) return;
      if (t.dataset.extra !== undefined) return cfg.extraButtons[+t.dataset.extra].onClick(() => App.route());
      if (t.dataset.add !== undefined) return openForm();
      if (t.dataset.retry !== undefined) return load();
      if (t.dataset.page) { st.page = +t.dataset.page; return load(); }
      const row = rows[+t.dataset.i];
      if (t.dataset.act === 'edit') openForm(row);
      if (t.dataset.act === 'view') modal({ title: `${cfg.singular} details`, body: cfg.detail(row), size: 'max-w-xl' });
      if (t.dataset.act === 'del' && await confirmBox(`Delete "${row.name}"? This cannot be undone.`)) {
        try { await API.del(`${cfg.endpoint}/${row.id}`); toast('Deleted successfully'); if (rows.length === 1 && st.page > 1) st.page--; load(); } catch (x) { toast(x.message, 'error'); }
      }
    });
    $('[data-search]', el).addEventListener('input', debounce(e => { st.search = e.target.value.trim(); st.page = 1; load(); }));
    $$('[data-filter]', el).forEach(s => s.addEventListener('change', () => { s.value ? st.filters[s.dataset.filter] = s.value : delete st.filters[s.dataset.filter]; st.page = 1; load(); }));
    $('[data-sort]', el)?.addEventListener('change', e => { const s = cfg.sort[+e.target.value]; st.sort = s.value; st.order = s.order || 'asc'; st.page = 1; load(); });
    load();
  };
}

// ----- Layout, router, topbar -----
const App = {
  start() {
    const u = API.user();
    if (!localStorage.getItem('sf_token') || !u) return API.logoutLocal();
    $('#uName').textContent = u.full_name; $('#uRole').textContent = u.role.replace('_', ' ');
    $('#avatar').textContent = (u.full_name || '?')[0].toUpperCase();
    $('#nav').innerHTML = MODULES.filter(m => canRead(m.perm)).map(m => `<a href="#/${m.key}" data-key="${m.key}" class="nav-item"><i data-lucide="${m.icon}" class="w-5 h-5 shrink-0"></i><span class="nav-label">${m.label}</span></a>`).join('');
    const sb = $('#sidebar'), bd = $('#backdrop');
    $('#menuBtn').onclick = () => { if (innerWidth < 1024) { sb.classList.toggle('open'); bd.classList.toggle('hidden'); } else sb.classList.toggle('collapsed'); };
    bd.onclick = () => { sb.classList.remove('open'); bd.classList.add('hidden'); };
    $('#nav').addEventListener('click', () => { sb.classList.remove('open'); bd.classList.add('hidden'); });
    $('#profileBtn').onclick = e => { e.stopPropagation(); $('#profilePanel').classList.toggle('hidden'); $('#bellPanel').classList.add('hidden'); };
    $('#bellBtn').onclick = e => { e.stopPropagation(); $('#bellPanel').classList.toggle('hidden'); $('#profilePanel').classList.add('hidden'); };
    document.addEventListener('click', e => { if (!e.target.closest('#bellPanel,#profilePanel')) { $('#bellPanel').classList.add('hidden'); $('#profilePanel').classList.add('hidden'); } });
    $('#logoutBtn').onclick = async () => { try { await API.post('/auth/logout'); } catch {} API.logoutLocal(); };
    $('#pwBtn').onclick = App.changePassword;
    $('#globalSearch').addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.value.trim() || !canRead('products')) return;
      window.__globalSearch = e.target.value.trim(); e.target.value = '';
      location.hash === '#/products' ? App.route() : (location.hash = '#/products');
    });
    window.addEventListener('hashchange', App.route);
    icons(); App.route(); App.loadNotifications(); setInterval(App.loadNotifications, 60000);
  },
  async route() {
    const key = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    const mod = MODULES.find(m => m.key === key && canRead(m.perm)) || MODULES[0];
    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.key === mod.key));
    $('#crumb').innerHTML = `Home <span class="mx-1">/</span> <span class="text-slate-700 font-medium">${mod.label}</span>`;
    const view = $('#view'); view.innerHTML = skeleton(8);
    try { await Views[mod.key](view); } catch (e) { view.innerHTML = errorState(e.message); }
    icons(); $('main').scrollTo(0, 0);
  },
  async loadNotifications() {
    try {
      const { data } = await API.get('/notifications');
      const c = $('#bellCount'); c.textContent = data.unread > 9 ? '9+' : data.unread; c.classList.toggle('hidden', !data.unread);
      $('#bellPanel').innerHTML = `<div class="px-4 py-3 border-b flex justify-between items-center"><span class="font-semibold text-sm">Notifications</span>${data.unread ? '<button id="readAll" class="text-xs text-blue-600">Mark all read</button>' : ''}</div>
        <div class="max-h-80 overflow-auto">${data.items.length ? data.items.map(n => `<div class="px-4 py-3 border-b text-sm ${n.is_read ? '' : 'bg-blue-50/50'}"><div class="font-medium">${esc(n.title)}</div><div class="text-xs text-slate-500">${esc(n.message)}</div><div class="text-[11px] text-slate-400 mt-1">${fmtDate(n.created_at)}</div></div>`).join('') : '<div class="p-6 text-center text-sm text-slate-400">No notifications</div>'}</div>`;
      $('#readAll')?.addEventListener('click', async () => { await API.put('/notifications/read-all'); App.loadNotifications(); });
    } catch {}
  },
  changePassword() {
    $('#profilePanel').classList.add('hidden');
    modal({ title: 'Change password', size: 'max-w-sm', body: `<form class="space-y-4"><div><label class="lbl">New password (min 8 characters)</label><input name="password" type="password" minlength="8" required class="input"></div>
      <p data-err class="text-sm text-red-600 hidden"></p><button class="btn btn-primary w-full justify-center">Update password</button></form>`,
      onMount: (w, close) => { $('form', w).onsubmit = async e => { e.preventDefault(); try { await API.post('/auth/change-password', formToObject(e.target)); toast('Password updated'); close(); } catch (x) { const p = $('[data-err]', w); p.textContent = x.message; p.classList.remove('hidden'); } }; } });
  }
};
// CSP blocks inline handlers, so hide broken images globally
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.style.display = 'none'; }, true);
