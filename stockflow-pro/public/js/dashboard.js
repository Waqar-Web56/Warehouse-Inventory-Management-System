let dashCharts = [];
Views.dashboard = async el => {
  dashCharts.forEach(c => c.destroy()); dashCharts = [];
  const { data: d } = await API.get('/dashboard');
  const s = d.stats;
  const card = (label, value, icon, color, sub = '') => `<div class="card p-4 flex items-center gap-4"><div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background:${color}1a;color:${color}"><i data-lucide="${icon}" class="w-6 h-6"></i></div>
    <div class="min-w-0"><div class="text-xs text-slate-500">${label}</div><div class="text-xl font-bold truncate">${value}</div>${sub ? `<div class="text-[11px] text-slate-400">${sub}</div>` : ''}</div></div>`;
  const list = (title, items, empty) => `<div class="card"><div class="px-4 py-3 border-b font-semibold text-sm">${title}</div><div class="divide-y">${items.length ? items.join('') : `<div class="p-6 text-center text-sm text-slate-400">${empty}</div>`}</div></div>`;
  const row = (a, b, c) => `<div class="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"><div class="min-w-0"><div class="font-medium truncate">${a}</div><div class="text-xs text-slate-500">${b}</div></div><div class="text-right shrink-0">${c}</div></div>`;
  const chartBox = (id, title, span = '') => `<div class="card p-4 ${span}"><div class="font-semibold text-sm mb-3">${title}</div><div class="h-64"><canvas id="${id}"></canvas></div></div>`;

  el.innerHTML = pageHeader('Dashboard', 'Live overview from your database') + `
  <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
    ${card('Total Products', num(s.total_products), 'package', '#2563EB')}
    ${card('Total Stock Quantity', num(s.total_stock), 'boxes', '#0EA5E9')}
    ${card('Warehouses', num(s.total_warehouses), 'warehouse', '#0B1F3A')}
    ${card('Total Purchases', money(s.purchases_total), 'shopping-cart', '#7C3AED', 'received, last 12 months')}
    ${card('Total Sales', money(s.sales_total), 'receipt', '#16A34A', 'completed, last 12 months')}
    ${card('Low Stock Products', num(s.low_stock), 'alert-triangle', '#DC2626')}
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
    ${chartBox('cSales', 'Sales vs Purchases Overview')}${chartBox('cRev', 'Monthly Revenue')}
    ${chartBox('cCat', 'Stock by Category')}${chartBox('cTop', 'Top Selling Products (units)')}
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
    ${list('Low Stock Alerts', d.low_stock.map(p => row(esc(p.name), esc(p.sku), `<span class="badge ${p.qty <= 0 ? 'b-red' : 'b-amber'}">${num(p.qty)} / min ${num(p.min_stock_level)}</span>`)), 'No low stock products')}
    ${list('Expiring Products', d.expiring.map(p => row(esc(p.name), esc(p.sku), `<span class="badge ${p.expiry_date < new Date().toISOString().slice(0, 10) ? 'b-red' : 'b-amber'}">${p.expiry_date}</span>`)), 'Nothing expiring soon')}
    ${list('Recent Activities', d.activities.map(a => row(`${esc(a.action)} ${esc(a.entity)}`, esc(a.user?.full_name || 'System'), `<span class="text-xs text-slate-400">${fmtDate(a.created_at)}</span>`)), 'No activity yet')}
    ${list('Recent Sales', d.recent_sales.map(x => row(esc(x.invoice_no), esc(x.customer?.name || 'Walk-in'), `<b>${money(x.grand_total)}</b><div>${statusBadge(x.status)}</div>`)), 'No sales yet')}
    ${list('Recent Purchases', d.recent_purchases.map(x => row(esc(x.invoice_no), esc(x.supplier?.name || ''), `<b>${money(x.grand_total)}</b><div>${statusBadge(x.status)}</div>`)), 'No purchases yet')}
    ${list('Recent Transactions', d.recent_movements.map(m => row(esc(m.product?.name), `${esc(m.warehouse?.name)} &middot; ${esc(m.movement_type.replace('_', ' '))}`, `<b class="${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}">${m.quantity > 0 ? '+' : ''}${num(m.quantity)}</b>`)), 'No stock movements yet')}
  </div>`;
  icons();

  const mk = (id, cfg) => { dashCharts.push(new Chart(document.getElementById(id), { ...cfg, options: { responsive: true, maintainAspectRatio: false, ...(cfg.options || {}) } })); };
  const labels = d.months.map(m => new Date(m + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }));
  mk('cSales', { type: 'line', data: { labels, datasets: [
    { label: 'Sales', data: d.sales_by_month, borderColor: '#2563EB', backgroundColor: '#2563EB22', fill: true, tension: .35 },
    { label: 'Purchases', data: d.purchases_by_month, borderColor: '#38BDF8', backgroundColor: '#38BDF822', fill: true, tension: .35 }] } });
  mk('cRev', { type: 'bar', data: { labels, datasets: [{ label: 'Revenue', data: d.sales_by_month, backgroundColor: '#2563EB', borderRadius: 6 }] }, options: { plugins: { legend: { display: false } } } });
  const cats = Object.entries(d.stock_by_category);
  mk('cCat', { type: 'doughnut', data: { labels: cats.map(c => c[0]), datasets: [{ data: cats.map(c => c[1]), backgroundColor: ['#0B1F3A', '#2563EB', '#38BDF8', '#7C3AED', '#16A34A', '#F59E0B', '#DC2626', '#64748B'] }] }, options: { plugins: { legend: { position: 'right' } } } });
  mk('cTop', { type: 'bar', data: { labels: d.top_products.map(p => p[0]), datasets: [{ label: 'Units sold', data: d.top_products.map(p => p[1]), backgroundColor: '#38BDF8', borderRadius: 6 }] }, options: { indexAxis: 'y', plugins: { legend: { display: false } } } });
};
