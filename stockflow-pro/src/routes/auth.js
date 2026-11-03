const router = require('express').Router();
const { supabaseAdmin, supabaseAuth } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { login, forgot, changePassword } = require('../validators/schemas');
const { ok, asyncHandler, AppError } = require('../utils/response');
const { audit } = require('../utils/audit');

router.post('/login', validate(login), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAuth.auth.signInWithPassword(req.body);
  if (error) throw new AppError('Invalid email or password', 401);
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', data.user.id).single();
  if (!profile || profile.status !== 'active') throw new AppError('Account is inactive', 403);
  req.user = profile; await audit(req, 'login', 'auth', profile.id);
  ok(res, { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, user: profile }, 'Logged in');
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  if (!req.body.refresh_token) throw new AppError('refresh_token required', 400);
  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: req.body.refresh_token });
  if (error) throw new AppError('Session expired', 401);
  ok(res, { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at });
}));

router.post('/forgot-password', validate(forgot), asyncHandler(async (req, res) => {
  await supabaseAuth.auth.resetPasswordForEmail(req.body.email, { redirectTo: `${process.env.APP_URL}/login.html?reset=1` });
  ok(res, null, 'If that email exists, a reset link has been sent'); // no account enumeration
}));

router.get('/me', authenticate, (req, res) => ok(res, req.user));

router.post('/change-password', authenticate, validate(changePassword), asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: req.body.password });
  if (error) throw new AppError(error.message, 400);
  await audit(req, 'change_password', 'auth', req.user.id);
  ok(res, null, 'Password updated');
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await supabaseAdmin.auth.admin.signOut((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  await audit(req, 'logout', 'auth', req.user.id);
  ok(res, null, 'Logged out');
}));
module.exports = router;
