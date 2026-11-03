-- StockFlow Pro Row Level Security. Run AFTER schema.sql and functions.sql.
-- The Express backend uses the service role (bypasses RLS) AND enforces RBAC itself.
-- These policies protect the data if anyone queries Supabase directly with a user JWT.

create or replace function sf_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and status = 'active' $$;

do $$ declare t text; begin
  foreach t in array array['profiles','employees','categories','brands','units','products','warehouses','warehouse_stock','stock_movements',
    'stock_transfers','stock_transfer_items','suppliers','customers','purchases','purchase_items','supplier_payments','sales','sale_items',
    'customer_payments','returns','return_items','notifications','audit_logs','company_settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop; end $$;

-- Read access: any active user for operational tables
do $$ declare t text; begin
  foreach t in array array['categories','brands','units','products','warehouses','warehouse_stock','stock_movements','stock_transfers',
    'stock_transfer_items','suppliers','customers','purchases','purchase_items','sales','sale_items','returns','return_items','notifications','company_settings'] loop
    execute format('create policy "%1$s_read" on %1$I for select to authenticated using (sf_role() is not null)', t);
  end loop; end $$;

-- Sensitive: profiles (self or admin), employees/audit/payments (admin or manager)
create policy profiles_read on profiles for select to authenticated using (id = auth.uid() or sf_role() = 'admin');
create policy profiles_admin_write on profiles for all to authenticated using (sf_role() = 'admin') with check (sf_role() = 'admin');
create policy employees_admin on employees for all to authenticated using (sf_role() = 'admin') with check (sf_role() = 'admin');
create policy audit_admin_read on audit_logs for select to authenticated using (sf_role() = 'admin');
create policy supplier_pay_read on supplier_payments for select to authenticated using (sf_role() in ('admin','warehouse_manager'));
create policy customer_pay_read on customer_payments for select to authenticated using (sf_role() in ('admin','sales_staff'));

-- Writes by role (stock_movements / warehouse_stock are written ONLY via sf_* functions, so no write policy)
create policy cat_write on categories for all to authenticated using (sf_role() in ('admin','warehouse_manager','inventory_staff')) with check (sf_role() in ('admin','warehouse_manager','inventory_staff'));
create policy brand_write on brands for all to authenticated using (sf_role() in ('admin','warehouse_manager','inventory_staff')) with check (sf_role() in ('admin','warehouse_manager','inventory_staff'));
create policy unit_write on units for all to authenticated using (sf_role() = 'admin') with check (sf_role() = 'admin');
create policy prod_write on products for all to authenticated using (sf_role() in ('admin','warehouse_manager','inventory_staff')) with check (sf_role() in ('admin','warehouse_manager','inventory_staff'));
create policy wh_write on warehouses for all to authenticated using (sf_role() in ('admin','warehouse_manager')) with check (sf_role() in ('admin','warehouse_manager'));
create policy transfer_write on stock_transfers for all to authenticated using (sf_role() in ('admin','warehouse_manager','inventory_staff')) with check (sf_role() in ('admin','warehouse_manager','inventory_staff'));
create policy transfer_items_write on stock_transfer_items for all to authenticated using (sf_role() in ('admin','warehouse_manager','inventory_staff')) with check (sf_role() in ('admin','warehouse_manager','inventory_staff'));
create policy supplier_write on suppliers for all to authenticated using (sf_role() in ('admin','warehouse_manager')) with check (sf_role() in ('admin','warehouse_manager'));
create policy purchase_write on purchases for all to authenticated using (sf_role() in ('admin','warehouse_manager')) with check (sf_role() in ('admin','warehouse_manager'));
create policy purchase_items_write on purchase_items for all to authenticated using (sf_role() in ('admin','warehouse_manager')) with check (sf_role() in ('admin','warehouse_manager'));
create policy customer_write on customers for all to authenticated using (sf_role() in ('admin','sales_staff')) with check (sf_role() in ('admin','sales_staff'));
create policy sale_write on sales for all to authenticated using (sf_role() in ('admin','sales_staff')) with check (sf_role() in ('admin','sales_staff'));
create policy sale_items_write on sale_items for all to authenticated using (sf_role() in ('admin','sales_staff')) with check (sf_role() in ('admin','sales_staff'));
create policy returns_write on returns for all to authenticated using (sf_role() in ('admin','warehouse_manager','sales_staff')) with check (sf_role() in ('admin','warehouse_manager','sales_staff'));
create policy return_items_write on return_items for all to authenticated using (sf_role() in ('admin','warehouse_manager','sales_staff')) with check (sf_role() in ('admin','warehouse_manager','sales_staff'));
create policy notif_update on notifications for update to authenticated using (sf_role() is not null) with check (sf_role() is not null);
create policy settings_admin on company_settings for update to authenticated using (sf_role() = 'admin') with check (sf_role() = 'admin');
