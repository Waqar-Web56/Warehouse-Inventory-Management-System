const router = require('express').Router();
const { supabaseAdmin: db } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { manualStock } = require('../validators/schemas');
const { ok, asyncHandler, paginate } = require('../utils/response');
const { audit } = require('../utils/audit');
router.use(authenticate, authorize('inventory'));

// Warehouse-wise stock levels
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = paginate(req.query);
  let q = db.from('warehouse_stock').select('quantity, warehouse:warehouses(id,name,code), product:products(id,name,sku,purchase_price,selling_price,min_stock_level)', { count: 'exact' });
  if (req.query.warehouse_id) q = q.eq('warehouse_id', req.query.warehouse_id);
  const { data, count, error } = await q.order('updated_at', { ascending: false }).range(from, to);
  if (error) throw error;
  ok(res, data, 'OK', 200, { page, limit, total: count, pages: Math.ceil((count || 0) / limit) });
}));

// Permanent ledger
router.get('/movements', asyncHandler(async (req, res) => {
  const { page, limit, from, to } = paginate(req.query);
  let q = db.from('stock_movements').select('*, product:products(name,sku), warehouse:warehouses(name)', { count: 'exact' });
  ['product_id', 'warehouse_id', 'movement_type'].forEach(f => req.query[f] && (q = q.eq(f, req.query[f])));
  if (req.query.from) q = q.gte('created_at', req.query.from);
  if (req.query.to) q = q.lte('created_at', req.query.to);
  const { data, count, error } = await q.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  ok(res, data, 'OK', 200, { page, limit, total: count, pages: Math.ceil((count || 0) / limit) });
}));

// Stock in / out / adjustment / opening (transaction-safe RPC)
router.post('/adjust', validate(manualStock), asyncHandler(async (req, res) => {
  const b = req.body;
  const { data, error } = await db.rpc('sf_manual_stock', { p_product: b.product_id, p_warehouse: b.warehouse_id, p_type: b.type, p_qty: b.quantity, p_user: req.user.id, p_note: b.note });
  if (error) throw error;
  await audit(req, b.type, 'inventory', b.product_id, b);
  ok(res, { balance: data }, 'Stock updated', 201);
}));

// Inventory valuation (at purchase cost)
router.get('/valuation', asyncHandler(async (req, res) => {
  const { data, error } = await db.from('warehouse_stock').select('quantity, warehouse:warehouses(name), product:products(name,sku,purchase_price)');
  if (error) throw error;
  const rows = data.map(r => ({ ...r, value: +(r.quantity * r.product.purchase_price).toFixed(2) }));
  ok(res, { total_value: +rows.reduce((s, r) => s + r.value, 0).toFixed(2), rows });
}));
module.exports = router;
