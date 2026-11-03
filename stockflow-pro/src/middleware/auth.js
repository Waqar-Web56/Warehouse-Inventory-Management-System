const { supabaseAdmin } = require('../config/supabase');
const { AppError, asyncHandler } = require('../utils/response');

// Role -> permitted modules. Enforced server-side on every route.
// 'module' = full access, 'module:read' = GET only.
const PERMISSIONS = {
  admin: ['*'],
  warehouse_manager: ['dashboard', 'products', 'warehouses', 'inventory', 'transfers', 'purchases', 'suppliers', 'barcodes', 'returns', 'reports', 'notifications', 'categories', 'brands'],
  inventory_staff: ['dashboard', 'products', 'inventory', 'transfers', 'barcodes', 'categories', 'brands', 'notifications', 'warehouses:read'],
  sales_staff: ['dashboard', 'sales', 'customers', 'barcodes', 'returns', 'notifications', 'products:read', 'inventory:read', 'warehouses:read']
};

const authenticate = asyncHandler(async (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError('Authentication required', 401);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new AppError('Invalid or expired session', 401);
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();
  if (!profile || profile.status !== 'active') throw new AppError('Account is inactive or has no profile', 403);
  req.user = profile;
  next();
});

const authorize = (module) => (req, res, next) => {
  const grants = PERMISSIONS[req.user.role] || [];
  const isRead = req.method === 'GET';
  const allowed = grants.includes('*') || grants.includes(module) || (isRead && grants.includes(`${module}:read`));
  if (!allowed) return next(new AppError('You do not have permission to perform this action', 403));
  next();
};
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError('Insufficient role', 403));

module.exports = { authenticate, authorize, requireRole, PERMISSIONS };
