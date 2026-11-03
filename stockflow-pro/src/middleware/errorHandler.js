const { ZodError } = require('zod');
const notFound = (req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' });
// Map Postgres errors to friendly HTTP responses
function mapDbError(err) {
  switch (err.code) {
    case '23505': return [409, 'Duplicate value: a record with this unique value already exists'];
    case '23503': return [409, 'Operation blocked: record is referenced by other data'];
    case '23514': return [422, 'Value violates a validation rule'];
    case 'P0001': return [422, err.message]; // RAISE EXCEPTION from our SQL functions
    default: return null;
  }
}
const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({ success: false, message: 'Validation failed',
      errors: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })) });
  }
  const db = err.code && mapDbError(err);
  if (db) return res.status(db[0]).json({ success: false, message: db[1] });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false,
    message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
};
module.exports = { notFound, errorHandler };
