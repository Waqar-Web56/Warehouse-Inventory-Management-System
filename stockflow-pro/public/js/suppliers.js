Views.suppliers = crudView({
  key: 'suppliers', module: 'suppliers', endpoint: '/suppliers', title: 'Suppliers', singular: 'Supplier', subtitle: 'Manage vendors and balances',
  sort: [{ label: 'Newest first', value: 'created_at', order: 'desc' }, { label: 'Name A-Z', value: 'name', order: 'asc' }],
  columns: [
    { label: 'Supplier', render: r => `<div class="font-semibold">${esc(r.name)}</div><div class="text-xs text-slate-500">${esc(r.company_name || '')}</div>` },
    { label: 'Phone', render: r => esc(r.phone || '-') }, { label: 'Email', render: r => esc(r.email || '-') }, { label: 'City', render: r => esc(r.city || '-') },
    { label: 'Balance (we owe)', render: r => `<b class="${r.current_balance > 0 ? 'text-red-600' : ''}">${money(r.current_balance)}</b>` }
  ],
  fields: [
    { name: 'name', label: 'Supplier name', required: true }, { name: 'company_name', label: 'Company name' },
    { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone' }, { name: 'city', label: 'City' },
    { name: 'opening_balance', label: 'Opening balance', type: 'number', step: '0.01', default: 0, createOnly: true },
    { name: 'address', label: 'Address', type: 'textarea', full: true }
  ]
});
