const router = require('express').Router();
const { supabaseAdmin: db } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { ok, asyncHandler } = require('../utils/response');
router.use(authenticate, authorize('notifications'));

router.get('/', asyncHandler(async (req, res) => {
  const [{ data: items, error }, { count }] = await Promise.all([
    db.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false)
  ]);
  if (error) throw error;
  ok(res, { items, unread: count || 0 });
}));
router.put('/read-all', asyncHandler(async (req, res) => {
  const { error } = await db.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw error; ok(res, null, 'All marked as read');
}));
router.put('/:id/read', asyncHandler(async (req, res) => {
  const { error } = await db.from('notifications').update({ is_read: true }).eq('id', req.params.id);
  if (error) throw error; ok(res, null, 'Marked as read');
}));
module.exports = router;
