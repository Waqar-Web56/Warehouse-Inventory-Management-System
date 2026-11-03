// Modules whose backend is scheduled for upcoming phases. Honest placeholders, no fake data.
const soon = (title, icon, text, phase) => async el => {
  el.innerHTML = `<h1 class="text-2xl font-bold mb-4">${title}</h1><div class="card py-16 text-center px-6"><i data-lucide="${icon}" class="w-12 h-12 mx-auto mb-3 text-blue-400"></i>
    <div class="font-semibold text-lg">Coming in ${phase}</div><p class="text-sm text-slate-500 max-w-md mx-auto mt-1">${text}</p></div>`;
};
Views.purchases = soon('Purchases', 'shopping-cart', 'Purchase orders with multiple products, discounts, tax, shipping, and receiving into stock.', 'Phase 4');
Views.sales = soon('Sales', 'receipt', 'Sales orders, invoices, partial payments, and automatic stock deduction.', 'Phase 5');
Views['barcode-returns'] = soon('Barcode & Returns', 'scan-barcode', 'Barcode labels, scanning, and sales/purchase returns.', 'Phase 6');
Views.reports = soon('Reports', 'bar-chart-3', 'Stock, sales, purchase, profit & loss reports with PDF and Excel export.', 'Phase 6');
Views.employees = soon('Employees & Users', 'user-cog', 'Employee records and user role management.', 'Phase 7');
Views.settings = soon('Settings', 'settings', 'Company profile, currency, tax, invoice and stock settings.', 'Phase 7');
