-- StockFlow Pro schema (PostgreSQL / Supabase). Run FIRST, then functions.sql, then policies.sql.
create extension if not exists pgcrypto;

create type user_role as enum ('admin','warehouse_manager','inventory_staff','sales_staff');
create type record_status as enum ('active','inactive');
create type purchase_status as enum ('draft','pending','approved','received','cancelled');
create type sale_status as enum ('draft','confirmed','completed','cancelled');
create type payment_status as enum ('unpaid','partial','paid');
create type movement_type as enum ('opening','purchase','sale','transfer_in','transfer_out','adjustment_in','adjustment_out','stock_in','stock_out','return_in','return_out');
create type transfer_status as enum ('draft','confirmed','cancelled');
create type return_kind as enum ('sale','purchase');
create type return_status as enum ('pending','approved','rejected');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== Users / HR =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null, email text not null unique, phone text,
  role user_role not null default 'sales_staff',
  status record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  full_name text not null, email text, phone text, address text,
  designation text, joining_date date, salary numeric(14,2) check (salary >= 0),
  status text not null default 'active' check (status in ('active','on_leave','terminated')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ===== Catalog =====
create table categories (id uuid primary key default gen_random_uuid(), name text not null unique, description text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table brands     (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table units      (id uuid primary key default gen_random_uuid(), name text not null unique, short_name text not null, created_at timestamptz not null default now());

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, sku text not null unique, barcode text unique,
  category_id uuid references categories(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  min_stock_level numeric(14,3) not null default 0 check (min_stock_level >= 0),
  description text, image_url text,
  expiry_date date,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_products_category on products(category_id);
create index idx_products_brand on products(brand_id);
create index idx_products_name on products(lower(name));

-- ===== Warehouses & stock =====
create table warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null, code text not null unique, address text, city text,
  manager text, contact_number text,
  status record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table warehouse_stock (
  warehouse_id uuid not null references warehouses(id) on delete restrict,
  product_id uuid not null references products(id) on delete restrict,
  quantity numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, product_id)
);
create index idx_ws_product on warehouse_stock(product_id);

-- Permanent, append-only ledger (see immutability trigger in functions.sql)
create table stock_movements (
  id bigserial primary key,
  product_id uuid not null references products(id),
  warehouse_id uuid not null references warehouses(id),
  movement_type movement_type not null,
  quantity numeric(14,3) not null check (quantity <> 0),   -- signed: + in, - out
  balance_after numeric(14,3) not null,
  unit_cost numeric(14,2),
  reference_type text, reference_id uuid, note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_sm_product_date on stock_movements(product_id, created_at desc);
create index idx_sm_warehouse_date on stock_movements(warehouse_id, created_at desc);
create index idx_sm_ref on stock_movements(reference_type, reference_id);

create table stock_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null unique default ('TRF-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  from_warehouse_id uuid not null references warehouses(id),
  to_warehouse_id uuid not null references warehouses(id),
  status transfer_status not null default 'draft',
  notes text, created_by uuid references profiles(id), confirmed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (from_warehouse_id <> to_warehouse_id)
);
create table stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(14,3) not null check (quantity > 0)
);

-- ===== Parties =====
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null, company_name text, email text, phone text, address text, city text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,      -- amount we owe
  status record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text, phone text, address text, city text,
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,      -- amount they owe us
  status record_status not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ===== Purchases =====
create table purchases (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default ('PO-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  supplier_id uuid not null references suppliers(id),
  warehouse_id uuid not null references warehouses(id),
  status purchase_status not null default 'draft',
  order_date date not null default current_date, received_at timestamptz,
  subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0), shipping numeric(14,2) not null default 0 check (shipping >= 0),
  grand_total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  payment_status payment_status not null default 'unpaid',
  notes text, created_by uuid references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_purchases_supplier on purchases(supplier_id);
create index idx_purchases_status on purchases(status, order_date desc);
create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  returned_qty numeric(14,3) not null default 0 check (returned_qty >= 0)
);
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id), purchase_id uuid references purchases(id),
  amount numeric(14,2) not null check (amount > 0), method text not null default 'cash',
  paid_at date not null default current_date, reference text, notes text,
  created_by uuid references profiles(id), created_at timestamptz not null default now()
);

-- ===== Sales =====
create table sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default ('INV-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  customer_id uuid references customers(id),
  warehouse_id uuid not null references warehouses(id),
  status sale_status not null default 'draft',
  sale_date date not null default current_date, completed_at timestamptz,
  subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0), shipping numeric(14,2) not null default 0 check (shipping >= 0),
  grand_total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  payment_status payment_status not null default 'unpaid',
  payment_method text default 'cash',
  notes text, created_by uuid references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index idx_sales_customer on sales(customer_id);
create index idx_sales_status on sales(status, sale_date desc);
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  unit_cost numeric(14,2) not null default 0,             -- snapshot for profit calc
  discount numeric(14,2) not null default 0, tax numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  returned_qty numeric(14,3) not null default 0 check (returned_qty >= 0)
);
create table customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id), sale_id uuid references sales(id),
  amount numeric(14,2) not null check (amount > 0), method text not null default 'cash',
  paid_at date not null default current_date, reference text, notes text,
  created_by uuid references profiles(id), created_at timestamptz not null default now()
);

-- ===== Returns =====
create table returns (
  id uuid primary key default gen_random_uuid(),
  return_no text not null unique default ('RET-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  kind return_kind not null,
  sale_id uuid references sales(id), purchase_id uuid references purchases(id),
  warehouse_id uuid not null references warehouses(id),
  reason text not null, return_date date not null default current_date,
  refund_amount numeric(14,2) not null default 0 check (refund_amount >= 0), refund_method text,
  status return_status not null default 'pending',
  created_by uuid references profiles(id), approved_by uuid references profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((kind = 'sale' and sale_id is not null) or (kind = 'purchase' and purchase_id is not null))
);
create table return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references returns(id) on delete cascade,
  product_id uuid not null references products(id),
  sale_item_id uuid references sale_items(id), purchase_item_id uuid references purchase_items(id),
  quantity numeric(14,3) not null check (quantity > 0)
);

-- ===== System =====
create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null, title text not null, message text,
  product_id uuid references products(id) on delete cascade,
  is_read boolean not null default false, created_at timestamptz not null default now()
);
create index idx_notif_unread on notifications(is_read, created_at desc);
create table audit_logs (
  id bigserial primary key, user_id uuid references profiles(id) on delete set null,
  action text not null, entity text not null, entity_id text,
  details jsonb not null default '{}', ip_address text, created_at timestamptz not null default now()
);
create index idx_audit_created on audit_logs(created_at desc);
create table company_settings (
  id int primary key default 1 check (id = 1),         -- single-row table
  company_name text not null default 'StockFlow Pro', logo_url text, address text, phone text, email text,
  currency text not null default 'PKR', tax_rate numeric(5,2) not null default 0,
  invoice_prefix text not null default 'INV', invoice_footer text,
  low_stock_threshold numeric(14,3) not null default 10,
  allow_negative_stock boolean not null default false,
  expiry_alert_days int not null default 30,
  updated_at timestamptz not null default now()
);
insert into company_settings (id) values (1) on conflict do nothing;
insert into units (name, short_name) values ('Piece','pcs'),('Kilogram','kg'),('Litre','ltr'),('Box','box'),('Dozen','dz') on conflict do nothing;

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['profiles','employees','categories','brands','products','warehouses','stock_transfers','suppliers','customers','purchases','sales','returns','company_settings'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function set_updated_at()', t);
  end loop; end $$;

-- Auto-create profile when a Supabase auth user is created
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email,
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'sales_staff'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
