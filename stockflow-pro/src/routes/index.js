const router = require('express').Router();
const crud = require('../services/crud');
const S = require('../validators/schemas');

router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));
router.use('/auth', require('./auth'));
router.use('/inventory', require('./inventory'));
router.use('/dashboard', require('./dashboard'));
router.use('/notifications', require('./notifications'));

router.use('/categories', crud({ table: 'categories', module: 'categories', schema: S.named, searchCols: ['name'], sortable: ['name', 'created_at'] }));
router.use('/brands', crud({ table: 'brands', module: 'brands', schema: S.named.omit({ description: true }), sortable: ['name', 'created_at'] }));
router.use('/units', crud({ table: 'units', module: 'products', schema: S.unit, searchCols: ['name'], sortable: ['name', 'created_at'] }));
router.use('/products', crud({
  table: 'products', module: 'products', schema: S.product,
  select: '*, category:categories(id,name), brand:brands(id,name), unit:units(id,short_name)',
  searchCols: ['name', 'sku', 'barcode'], filters: ['category_id', 'brand_id', 'status'],
  sortable: ['created_at', 'name', 'selling_price', 'sku']
}));
router.use('/warehouses', crud({ table: 'warehouses', module: 'warehouses', schema: S.warehouse, searchCols: ['name', 'code', 'city'], filters: ['status'], sortable: ['created_at', 'name'] }));
router.use('/suppliers', crud({ table: 'suppliers', module: 'suppliers', schema: S.party, searchCols: ['name', 'company_name', 'phone'], sortable: ['created_at', 'name'],
  beforeSave: async (b, req, mode) => mode === 'create' ? { ...b, current_balance: b.opening_balance } : (({ opening_balance, ...rest }) => rest)(b) }));
router.use('/customers', crud({ table: 'customers', module: 'customers', schema: S.party.omit({ company_name: true }), searchCols: ['name', 'phone', 'email'], sortable: ['created_at', 'name'],
  beforeSave: async (b, req, mode) => mode === 'create' ? { ...b, current_balance: b.opening_balance } : (({ opening_balance, ...rest }) => rest)(b) }));

// Next phases mount here: transfers, purchases, sales, barcodes, returns, reports,
// employees, users, settings, notifications, dashboard.
module.exports = router;
