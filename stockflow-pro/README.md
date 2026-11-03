# StockFlow Pro
Warehouse & Inventory Management (Node/Express + Supabase PostgreSQL + Vanilla JS/Tailwind).

## Build status
- [x] Phase 1-2 (backend core): config, auth, RBAC, validation, error handling, rate limiting, audit log
- [x] Phase 2: `database/schema.sql`, `functions.sql` (atomic stock logic), `policies.sql` (RLS)
- [x] Routes live: auth, categories, brands, products, warehouses, suppliers, customers, inventory
- [x] Phase 3 frontend: login, sidebar layout, dashboard, products, warehouses, inventory, suppliers, customers
- [ ] Next: transfers, purchases, sales, returns, reports, employees/users, settings, seed script

## Setup
1. Create a Supabase project. In the SQL editor run, in order: `database/schema.sql`, `database/functions.sql`, `database/policies.sql`.
2. `cp .env.example .env` and fill in the URL, anon key and service-role key (service-role stays server-side only).
3. `npm install && npm run dev`
4. Create the first admin: Supabase Dashboard > Authentication > Add user, then run:
   `update profiles set role = 'admin' where email = 'you@example.com';`

## Design notes
- All stock changes go through `sf_apply_stock` (row-locked, ledger entry written in the same transaction). The ledger is append-only (trigger-enforced).
- Negative stock is blocked unless `company_settings.allow_negative_stock` is enabled by an admin.
- RBAC is enforced in `src/middleware/auth.js` on every route; RLS is a second layer.
