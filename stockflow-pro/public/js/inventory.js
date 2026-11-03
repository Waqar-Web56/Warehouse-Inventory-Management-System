Views.inventory = async el => {
  const write = canWrite('inventory');
  const [whs, prods] = await Promise.all([API.get('/warehouses', { limit: 100, sort: 'name', order: 'asc' }), API.get('/products', { limit: 100, sort: 'name', order: 'asc' })]);
  const st = { tab: 'stock', page: 1, wh: '', type: '', product: '' };
  const TYPES = { opening: 'Opening Stock', stock_in: 'Stock In', stock_out: 'Stock Out', adjustment_in: 'Adjustment (+)', adjustment_out: 'Adjustment (-)', purchase: 'Purchase', sale: 'Sale', transfer_in: 'Transfer In', transfer_out: 'Transfer Out', return_in: 'Return In', return_out: 'Return Out' };
  const whOpts = (sel) => `<option value="">All warehouses</option>${whs.data.map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}`;

  el.innerHTML = pageHeader('Inventory', 'Warehouse-wise stock, movement ledger and valuation', write ? '<button data-adjust class="btn btn-primary"><i data-lucide="plus" class="w-4 h-4"></i>Stock In / Out / Adjust</button>' : '') + `
    <div class="flex gap-1 mb-4 border-b">${[['stock', 'Stock Levels'], ['moves', 'Movement History'], ['value', 'Valuation']].map(([k, l]) => `<button data-tab="${k}" class="px-4 py-2 text-sm font-semibold border-b-2 -mb-px">${l}</button>`).join('')}</div>
    <div data-filters class="card p-4 mb-4 flex flex-wrap gap-3"></div><div class="card overflow-hidden"><div data-body></div><div data-pager></div></div>`;
  const body = $('[data-body]', el), pg = $('[data-pager]', el), fl = $('[data-filters]', el);

  function tabs() { $$('[data-tab]', el).forEach(b => { const a = b.dataset.tab === st.tab; b.className = `px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${a ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`; }); }
  function filters() {
    fl.innerHTML = st.tab === 'value' ? '<span class="text-sm text-slate-500">Valued at purchase cost across all warehouses.</span>' :
      `<select data-f="wh" class="input !w-auto">${whOpts(st.wh)}</select>` +
      (st.tab === 'moves' ? `<select data-f="product" class="input !w-auto"><option value="">All products</option>${prods.data.map(p => `<option value="${p.id}" ${p.id === st.product ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <select data-f="type" class="input !w-auto"><option value="">All types</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === st.type ? 'selected' : ''}>${v}</option>`).join('')}</select>` : '');
  }
  async function load() {
    tabs(); filters(); body.innerHTML = skeleton(); pg.innerHTML = '';
    try {
      if (st.tab === 'stock') {
        const r = await API.get('/inventory', { page: st.page, limit: 10, warehouse_id: st.wh });
        if (!r.data.length) { body.innerHTML = emptyState('No stock yet', write ? 'Use "Stock In / Out / Adjust" to add opening stock.' : ''); return icons(); }
        body.innerHTML = `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Product</th><th>Warehouse</th><th>Quantity</th><th>Status</th><th>Value (cost)</th></tr></thead><tbody>${r.data.map(x => {
          const q = Number(x.quantity), min = Number(x.product.min_stock_level);
          return `<tr><td><div class="font-semibold">${esc(x.product.name)}</div><div class="text-xs text-slate-500">${esc(x.product.sku)}</div></td><td>${esc(x.warehouse.name)}</td><td><b>${num(q)}</b></td>
            <td>${q <= 0 ? badge('Out of stock', 'red') : (min > 0 && q <= min ? badge('Low stock', 'amber') : badge('In stock', 'green'))}</td><td>${money(q * x.product.purchase_price)}</td></tr>`;
        }).join('')}</tbody></table></div>`; pg.innerHTML = pager(r.meta);
      } else if (st.tab === 'moves') {
        const r = await API.get('/inventory/movements', { page: st.page, limit: 10, warehouse_id: st.wh, product_id: st.product, movement_type: st.type });
        if (!r.data.length) { body.innerHTML = emptyState('No stock movements found'); return icons(); }
        body.innerHTML = `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Date</th><th>Product</th><th>Warehouse</th><th>Type</th><th>Change</th><th>Balance</th><th>Note</th></tr></thead><tbody>${r.data.map(m => `<tr><td class="whitespace-nowrap">${fmtDate(m.created_at)}</td><td>${esc(m.product?.name)}</td><td>${esc(m.warehouse?.name)}</td><td>${badge(TYPES[m.movement_type] || m.movement_type, m.quantity > 0 ? 'green' : 'red')}</td>
          <td><b class="${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}">${m.quantity > 0 ? '+' : ''}${num(m.quantity)}</b></td><td>${num(m.balance_after)}</td><td class="text-xs text-slate-500">${esc(m.note || '')}</td></tr>`).join('')}</tbody></table></div>`; pg.innerHTML = pager(r.meta);
      } else {
        const { data } = await API.get('/inventory/valuation');
        body.innerHTML = `<div class="p-5 border-b"><div class="text-xs text-slate-500">Total inventory value</div><div class="text-2xl font-bold">${money(data.total_value)}</div></div>` +
          (data.rows.length ? `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Product</th><th>Warehouse</th><th>Qty</th><th>Unit cost</th><th>Value</th></tr></thead><tbody>${data.rows.map(r => `<tr><td>${esc(r.product.name)}</td><td>${esc(r.warehouse.name)}</td><td>${num(r.quantity)}</td><td>${money(r.product.purchase_price)}</td><td><b>${money(r.value)}</b></td></tr>`).join('')}</tbody></table></div>` : emptyState('No inventory to value'));
      }
    } catch (e) { body.innerHTML = errorState(e.message); }
    icons();
  }
  function adjustForm() {
    modal({ title: 'Stock In / Out / Adjustment', body: `<form class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="sm:col-span-2"><label class="lbl">Product *</label><select name="product_id" required class="input"><option value="">Select product...</option>${prods.data.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}</select></div>
      <div><label class="lbl">Warehouse *</label><select name="warehouse_id" required class="input"><option value="">Select...</option>${whs.data.filter(w => w.status === 'active').map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></div>
      <div><label class="lbl">Type *</label><select name="type" class="input">${['opening', 'stock_in', 'stock_out', 'adjustment_in', 'adjustment_out'].map(k => `<option value="${k}">${TYPES[k]}</option>`).join('')}</select></div>
      <div><label class="lbl">Quantity *</label><input name="quantity" type="number" min="0.001" step="0.001" required class="input"></div>
      <div><label class="lbl">Note</label><input name="note" class="input"></div>
      <p data-err class="sm:col-span-2 text-sm text-red-600 hidden"></p>
      <div class="sm:col-span-2 flex justify-end gap-2"><button type="button" data-c class="btn btn-ghost">Cancel</button><button class="btn btn-primary">Apply</button></div></form>`,
      onMount: (w, close) => {
        $('[data-c]', w).onclick = close;
        $('form', w).onsubmit = async e => { e.preventDefault(); const b = $('button.btn-primary', w); b.disabled = true;
          try { const r = await API.post('/inventory/adjust', formToObject(e.target)); toast(`Stock updated. New balance: ${num(r.data.balance)}`); close(); load(); }
          catch (x) { const p = $('[data-err]', w); p.textContent = x.message; p.classList.remove('hidden'); b.disabled = false; } };
      } });
  }
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-tab],[data-adjust],[data-page],[data-retry]'); if (!t) return;
    if (t.dataset.tab) { st.tab = t.dataset.tab; st.page = 1; load(); }
    else if (t.dataset.adjust !== undefined) adjustForm();
    else if (t.dataset.page) { st.page = +t.dataset.page; load(); }
    else load();
  });
  el.addEventListener('change', e => { const f = e.target.dataset.f; if (f) { st[f] = e.target.value; st.page = 1; load(); } });
  load();
};
