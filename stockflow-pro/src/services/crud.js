// Generic, validated CRUD router factory (search, filter, sort, pagination)
const express = require('express');
const { supabaseAdmin: db } = require('../config/supabase');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, asyncHandler, paginate, AppError } = require('../utils/response');
const { audit } = require('../utils/audit');

module.exports = function crud({ table, module, schema, select = '*', searchCols = ['name'], filters = [], sortable = ['created_at'], beforeSave }) {
  const r = express.Router();
  r.use(authenticate, authorize(module));

  r.get('/', asyncHandler(async (req, res) => {
    const { page, limit, from, to } = paginate(req.query);
    let q = db.from(table).select(select, { count: 'exact' });
    const s = (req.query.search || '').trim().replace(/[%,()]/g, '');
    if (s) q = q.or(searchCols.map(c => `${c}.ilike.%${s}%`).join(','));
    filters.forEach(f => { if (req.query[f]) q = q.eq(f, req.query[f]); });
    const sort = sortable.includes(req.query.sort) ? req.query.sort : sortable[0];
    q = q.order(sort, { ascending: req.query.order === 'asc' }).range(from, to);
    const { data, count, error } = await q;
    if (error) throw error;
    ok(res, data, 'OK', 200, { page, limit, total: count, pages: Math.ceil((count || 0) / limit) });
  }));

  r.get('/:id', asyncHandler(async (req, res) => {
    const { data, error } = await db.from(table).select(select).eq('id', req.params.id).single();
    if (error) throw new AppError(`${table} record not found`, 404);
    ok(res, data);
  }));

  r.post('/', validate(schema), asyncHandler(async (req, res) => {
    const body = beforeSave ? await beforeSave(req.body, req, 'create') : req.body;
    const { data, error } = await db.from(table).insert(body).select().single();
    if (error) throw error;
    await audit(req, 'create', table, data.id, { name: data.name });
    ok(res, data, 'Created successfully', 201);
  }));

  r.put('/:id', validate(schema), asyncHandler(async (req, res) => {
    const body = beforeSave ? await beforeSave(req.body, req, 'update') : req.body;
    const { data, error } = await db.from(table).update(body).eq('id', req.params.id).select().single();
    if (error) throw error;
    await audit(req, 'update', table, req.params.id);
    ok(res, data, 'Updated successfully');
  }));

  r.delete('/:id', asyncHandler(async (req, res) => {
    const { error } = await db.from(table).delete().eq('id', req.params.id);
    if (error) throw error;
    await audit(req, 'delete', table, req.params.id);
    ok(res, null, 'Deleted successfully');
  }));
  return r;
};
