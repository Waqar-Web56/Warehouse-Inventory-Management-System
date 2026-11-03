const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase environment variables');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
// Admin client: server only, bypasses RLS. Authorization is enforced in middleware.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opts);
// Anon client: used for sign-in / password reset flows.
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
module.exports = { supabaseAdmin, supabaseAuth };
