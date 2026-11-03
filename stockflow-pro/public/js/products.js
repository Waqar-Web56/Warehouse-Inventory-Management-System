const listOpts = (ep, label = 'name') => async () => (await API.get(ep, { limit: 100, sort: 'name', order: 'asc' })).data.map(r => ({ value: r.id, label: r[label] }));
Views.products = crudView({
  key: 'products', module: 'products', endpoint: '/products', title: 'Products', singular: 'Product', subtitle: 'Manage your product catalog',
  sort: [{ label: 'Newest first', value: 'created_at', order: 'desc' }, { label: 'Name A-Z', value: 'name', order: 'asc' }, { label: 'Price: low to high', value: 'selling_price', order: 'asc' }, { label: 'Price: high to low', value: 'selling_price', order: 'desc' }, { label: 'SKU', value: 'sku', order: 'asc' }],
  filters: [{ name: 'category_id', label: 'All categories', options: listOpts('/categories') }, { name: 'brand_id', label: 'All brands', options: listOpts('/brands') }],
  extraButtons: [
    { label: '+ Category', onClick: done => promptCreate('New category', 'Category name', '/categories', done) },
    { label: '+ Brand', onClick: done => promptCreate('New brand', 'Brand name', '/brands', done) }
  ],
  columns: [
    { label: 'Product', render: r => `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">${r.image_url ? `<img src="${esc(r.image_url)}" alt="" class="w-full h-full object-cover">` : '<i data-lucide="package" class="w-5 h-5 text-slate-300"></i>'}</div><div><div class="font-semibold">${esc(r.name)}</div><div class="text-xs text-slate-500">${esc(r.sku)}</div></div></div>` },
    { label: 'Barcode', render: r => esc(r.barcode || '-') },
    { label: 'Category', render: r => esc(r.category?.name || '-') },
    { label: 'Brand', render: r => esc(r.brand?.name || '-') },
    { label: 'Cost', render: r => money(r.purchase_price) },
    { label: 'Price', render: r => `<b>${money(r.selling_price)}</b>` },
    { label: 'Status', render: r => statusBadge(r.status) }
  ],
  fields: [
    { name: 'name', label: 'Product name', required: true },
    { name: 'sku', label: 'SKU', required: true },
    { name: 'barcode', label: 'Barcode' },
    { name: 'category_id', label: 'Category', options: listOpts('/categories') },
    { name: 'brand_id', label: 'Brand', options: listOpts('/brands') },
    { name: 'unit_id', label: 'Unit', options: listOpts('/units') },
    { name: 'purchase_price', label: 'Purchase price', type: 'number', step: '0.01', required: true, default: 0 },
    { name: 'selling_price', label: 'Selling price', type: 'number', step: '0.01', required: true, default: 0 },
    { name: 'min_stock_level', label: 'Minimum stock level', type: 'number', step: '0.001', default: 0 },
    { name: 'expiry_date', label: 'Expiry date', type: 'date' },
    { name: 'image_url', label: 'Image URL', full: true },
    { name: 'description', label: 'Description', type: 'textarea', full: true },
    { name: 'status', label: 'Status', type: 'select', choices: ['active', 'inactive'], default: 'active' }
  ],
  detail: r => `<div class="flex gap-4 mb-4">${r.image_url ? `<img src="${esc(r.image_url)}" class="w-24 h-24 rounded-xl object-cover" alt="">` : ''}<div><h4 class="text-lg font-bold">${esc(r.name)}</h4><div class="text-sm text-slate-500">${esc(r.sku)} ${statusBadge(r.status)}</div></div></div>
    <dl class="grid grid-cols-2 gap-3 text-sm">${[['Barcode', r.barcode], ['Category', r.category?.name], ['Brand', r.brand?.name], ['Unit', r.unit?.short_name], ['Purchase price', money(r.purchase_price)], ['Selling price', money(r.selling_price)], ['Min stock', num(r.min_stock_level)], ['Expiry', r.expiry_date || '-']].map(([k, v]) => `<div><dt class="text-xs text-slate-500">${k}</dt><dd class="font-medium">${esc(v || '-')}</dd></div>`).join('')}</dl>
    ${r.description ? `<p class="text-sm text-slate-600 mt-4">${esc(r.description)}</p>` : ''}`
});
