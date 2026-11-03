class AppError extends Error {
  constructor(message, status = 400, details) { super(message); this.status = status; this.details = details; }
}
const ok = (res, data = null, message = 'OK', status = 200, meta) =>
  res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const paginate = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 100);
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
};
module.exports = { AppError, ok, asyncHandler, paginate };
