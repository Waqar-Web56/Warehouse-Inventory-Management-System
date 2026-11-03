const router = require('express').Router();
const crud =require('./services/crud');
const S = require('../validators/schemas');

router.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// Setup diagnostics (disabled in production). Shows DB connectivity and which kind of key is configured. Never prints keys.
router.get('/health/db', async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false, message: 'Not found' });
  const { supabaseAdmin: db } = require('../config/supabase');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  let keyType = 'unknown';
  try {
    if (key.startsWith('eyJ')) keyType = 'jwt role = ' + JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
    else if (key.startsWith('sb_secret_')) keyType = 'secret key (correct)';
    else if (key.startsWith('sb_publishable_')) keyType = 'publishable key (WRONG: need the secret/service_role key)';
  } catch { keyType = 'could not read key'; }
  const out = { service_key_type: keyType, key_ok: /service_role|secret key \(correct\)/.test(keyType), tables: {} };
  for (const t of ['profiles', 'categories', 'products', 'warehouses', 'warehouse_stock', 'company_settings']) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    out.tables[t] = error ? `ERROR: ${error.message}` : `${count} rows`;
  }
  res.json(out);
});
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