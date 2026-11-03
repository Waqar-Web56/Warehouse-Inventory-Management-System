Views.customers = crudView({
  key: 'customers', module: 'customers', endpoint: '/customers', title: 'Customers', singular: 'Customer', subtitle: 'Manage customers and balances',
  sort: [{ label: 'Newest first', value: 'created_at', order: 'desc' }, { label: 'Name A-Z', value: 'name', order: 'asc' }],
  columns: [
    { label: 'Customer', render: r => `<div class="font-semibold">${esc(r.name)}</div>` },
    { label: 'Phone', render: r => esc(r.phone || '-') }, { label: 'Email', render: r => esc(r.email || '-') }, { label: 'City', render: r => esc(r.city || '-') },
    { label: 'Balance (they owe)', render: r => `<b class="${r.current_balance > 0 ? 'text-amber-600' : ''}">${money(r.current_balance)}</b>` }
  ],
  fields: [
    { name: 'name', label: 'Customer name', required: true }, { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Phone' }, { name: 'city', label: 'City' },
    { name: 'opening_balance', label: 'Opening balance', type: 'number', step: '0.01', default: 0, createOnly: true },
    { name: 'address', label: 'Address', type: 'textarea', full: true }
  ]
});
