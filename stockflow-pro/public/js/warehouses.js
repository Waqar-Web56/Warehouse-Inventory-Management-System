Views.warehouses = crudView({
  key: 'warehouses', module: 'warehouses', endpoint: '/warehouses', title: 'Warehouses', singular: 'Warehouse', subtitle: 'Manage storage locations',
  sort: [{ label: 'Newest first', value: 'created_at', order: 'desc' }, { label: 'Name A-Z', value: 'name', order: 'asc' }],
  filters: [{ name: 'status', label: 'All statuses', options: async () => [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] }],
  columns: [
    { label: 'Warehouse', render: r => `<div class="font-semibold">${esc(r.name)}</div><div class="text-xs text-slate-500">${esc(r.code)}</div>` },
    { label: 'City', render: r => esc(r.city || '-') },
    { label: 'Manager', render: r => esc(r.manager || '-') },
    { label: 'Contact', render: r => esc(r.contact_number || '-') },
    { label: 'Status', render: r => statusBadge(r.status) }
  ],
  fields: [
    { name: 'name', label: 'Warehouse name', required: true }, { name: 'code', label: 'Warehouse code', required: true },
    { name: 'city', label: 'City' }, { name: 'manager', label: 'Manager' }, { name: 'contact_number', label: 'Contact number' },
    { name: 'status', label: 'Status', type: 'select', choices: ['active', 'inactive'], default: 'active' },
    { name: 'address', label: 'Address', type: 'textarea', full: true }
  ],
  detail: r => `<h4 class="text-lg font-bold mb-1">${esc(r.name)} ${statusBadge(r.status)}</h4><p class="text-sm text-slate-500 mb-4">${esc(r.code)}</p>
    <dl class="grid grid-cols-2 gap-3 text-sm">${[['City', r.city], ['Manager', r.manager], ['Contact', r.contact_number], ['Address', r.address]].map(([k, v]) => `<div><dt class="text-xs text-slate-500">${k}</dt><dd class="font-medium">${esc(v || '-')}</dd></div>`).join('')}</dl>
    <p class="text-xs text-slate-400 mt-4">Warehouse stock levels are under Inventory.</p>`
});
