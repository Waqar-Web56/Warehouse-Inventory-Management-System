const { z } = require('zod');
const uuid = z.string().uuid();
const money = z.coerce.number().min(0);
const optStr = z.string().trim().max(500).optional().nullable().transform(v => v || null);

exports.login = z.object({ email: z.string().email(), password: z.string().min(6) });
exports.forgot = z.object({ email: z.string().email() });
exports.changePassword = z.object({ password: z.string().min(8, 'Password must be at least 8 characters') });

exports.product = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(60),
  barcode: optStr, category_id: uuid.optional().nullable(), brand_id: uuid.optional().nullable(), unit_id: uuid.optional().nullable(),
  purchase_price: money, selling_price: money, min_stock_level: money.default(0),
  description: optStr, image_url: optStr, expiry_date: z.string().date().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active')
});
exports.warehouse = z.object({
  name: z.string().trim().min(1).max(150), code: z.string().trim().min(1).max(30),
  address: optStr, city: optStr, manager: optStr, contact_number: optStr,
  status: z.enum(['active', 'inactive']).default('active')
});
exports.named = z.object({ name: z.string().trim().min(1).max(120), description: optStr });
exports.party = z.object({
  name: z.string().trim().min(1).max(150), company_name: optStr, email: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
  phone: optStr, address: optStr, city: optStr, opening_balance: z.coerce.number().default(0)
});
exports.manualStock = z.object({
  product_id: uuid, warehouse_id: uuid,
  type: z.enum(['opening', 'stock_in', 'stock_out', 'adjustment_in', 'adjustment_out']),
  quantity: z.coerce.number().positive(), note: optStr
});
exports.unit = z.object({ name: z.string().trim().min(1).max(60), short_name: z.string().trim().min(1).max(10) });
