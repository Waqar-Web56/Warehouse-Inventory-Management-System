const router = require('express').Router();
const { supabaseAdmin: db } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { ok, asyncHandler } = require('../utils/response');
router.use(authenticate, authorize('dashboard'));

const ym = (d) => String(d).slice(0, 7);

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(d.toISOString().slice(0, 7)); }
  const since = months[0] + '-01';
  const { data: settings } = await db.from('company_settings').select('expiry_alert_days').eq('id', 1).single();
  const expiryLimit = new Date(Date.now() + (settings?.expiry_alert_days ?? 30) * 86400000).toISOString().slice(0, 10);

  const [products, stock, whCount, sales, purchases, cats, items, acts, rSales, rPurch, moves] = await Promise.all([
    db.from('products').select('id,name,sku,min_stock_level,category_id,expiry_date').eq('status', 'active'),
    db.from('warehouse_stock').select('product_id,quantity'),
    db.from('warehouses').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('sales').select('sale_date,grand_total').eq('status', 'completed').gte('sale_date', since),
    db.from('purchases').select('order_date,grand_total').eq('status', 'received').gte('order_date', since),
    db.from('categories').select('id,name'),
    db.from('sale_items').select('quantity, product:products(name), sale:sales!inner(status,sale_date)').eq('sale.status', 'completed').gte('sale.sale_date', since),
    db.from('audit_logs').select('action,entity,created_at,user:profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    db.from('sales').select('invoice_no,grand_total,status,sale_date,customer:customers(name)').order('created_at', { ascending: false }).limit(5),
    db.from('purchases').select('invoice_no,grand_total,status,order_date,supplier:suppliers(name)').order('created_at', { ascending: false }).limit(5),
    db.from('stock_movements').select('movement_type,quantity,created_at,product:products(name),warehouse:warehouses(name)').order('created_at', { ascending: false }).limit(6)
  ]);
  for (const r of [products, stock, sales, purchases, cats, items, acts, rSales, rPurch, moves]) if (r.error) throw r.error;

  const totals = {};
  stock.data.forEach(r => { totals[r.product_id] = (totals[r.product_id] || 0) + Number(r.quantity); });
  const totalQty = Object.values(totals).reduce((a, b) => a + b, 0);

  const low = products.data.map(p => ({ ...p, qty: totals[p.id] || 0 }))
    .filter(p => p.qty <= 0 || (p.min_stock_level > 0 && p.qty <= p.min_stock_level))
    .sort((a, b) => a.qty - b.qty);

  const sum = (rows, dateKey) => months.map(m => +rows.filter(r => ym(r[dateKey]) === m).reduce((s, r) => s + Number(r.grand_total), 0).toFixed(2));
  const salesByMonth = sum(sales.data, 'sale_date'), purchasesByMonth = sum(purchases.data, 'order_date');

  const catName = Object.fromEntries(cats.data.map(c => [c.id, c.name]));
  const byCat = {};
  products.data.forEach(p => { const n = catName[p.category_id] || 'Uncategorized'; byCat[n] = (byCat[n] || 0) + (totals[p.id] || 0); });

  const top = {};
  items.data.forEach(i => { const n = i.product?.name || 'Unknown'; top[n] = (top[n] || 0) + Number(i.quantity); });
  const topProducts = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);

  ok(res, {
    stats: {
      total_products: products.data.length, total_stock: totalQty, total_warehouses: whCount.count || 0,
      purchases_total: purchasesByMonth.reduce((a, b) => a + b, 0), sales_total: salesByMonth.reduce((a, b) => a + b, 0),
      low_stock: low.length
    },
    months, sales_by_month: salesByMonth, purchases_by_month: purchasesByMonth,
    stock_by_category: byCat, top_products: topProducts,
    low_stock: low.slice(0, 8),
    expiring: products.data.filter(p => p.expiry_date && p.expiry_date <= expiryLimit).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).slice(0, 8),
    activities: acts.data, recent_sales: rSales.data, recent_purchases: rPurch.data, recent_movements: moves.data
  });
}));
module.exports = router;
