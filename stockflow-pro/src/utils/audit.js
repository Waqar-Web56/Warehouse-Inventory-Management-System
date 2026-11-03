const { supabaseAdmin } = require('../config/supabase');
async function audit(req, action, entity, entityId, details = {}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: req.user?.id, action, entity, entity_id: entityId ? String(entityId) : null,
      details, ip_address: req.ip
    });
  } catch (e) { console.error('audit failed', e.message); }
}
module.exports = { audit };
