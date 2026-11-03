-- StockFlow Pro: transaction-safe business logic. Run AFTER schema.sql.
-- Every function runs in a single transaction and locks rows (FOR UPDATE) to prevent races/duplicates.

-- Ledger is permanent: block UPDATE/DELETE
create or replace function sf_block_ledger_change() returns trigger language plpgsql as $$
begin raise exception 'stock_movements is an append-only ledger'; end $$;
drop trigger if exists trg_ledger_immutable on stock_movements;
create trigger trg_ledger_immutable before update or delete on stock_movements
  for each row execute function sf_block_ledger_change();

create or replace function sf_pay_status(p_total numeric, p_paid numeric) returns payment_status
language sql immutable as $$
  select case when p_paid <= 0 then 'unpaid'::payment_status
              when p_paid >= p_total then 'paid'::payment_status else 'partial'::payment_status end $$;

-- Low / out-of-stock alerts (deduplicated while an unread alert exists)
create or replace function sf_check_alerts(p_product uuid) returns void language plpgsql as $$
declare v_total numeric; v_min numeric; v_name text;
begin
  select coalesce(sum(quantity),0) into v_total from warehouse_stock where product_id = p_product;
  select min_stock_level, name into v_min, v_name from products where id = p_product;
  if v_total <= 0 then
    insert into notifications (type,title,message,product_id)
    select 'out_of_stock','Out of stock', v_name || ' is out of stock', p_product
    where not exists (select 1 from notifications where product_id=p_product and type='out_of_stock' and not is_read);
  elsif v_total <= v_min then
    insert into notifications (type,title,message,product_id)
    select 'low_stock','Low stock', v_name || ' is at ' || v_total || ' (minimum ' || v_min || ')', p_product
    where not exists (select 1 from notifications where product_id=p_product and type='low_stock' and not is_read);
  end if;
end $$;

-- Core primitive: apply a signed stock change, lock the row, write ledger entry.
create or replace function sf_apply_stock(
  p_product uuid, p_warehouse uuid, p_delta numeric, p_type movement_type,
  p_ref_type text, p_ref_id uuid, p_user uuid, p_note text default null, p_cost numeric default null
) returns numeric language plpgsql as $$
declare v_qty numeric; v_new numeric; v_allow boolean; v_name text;
begin
  if p_delta = 0 then raise exception 'Quantity must not be zero'; end if;
  insert into warehouse_stock (warehouse_id, product_id, quantity) values (p_warehouse, p_product, 0)
    on conflict (warehouse_id, product_id) do nothing;
  select quantity into v_qty from warehouse_stock
    where warehouse_id = p_warehouse and product_id = p_product for update;
  v_new := v_qty + p_delta;
  select allow_negative_stock into v_allow from company_settings where id = 1;
  if v_new < 0 and not coalesce(v_allow,false) then
    select name into v_name from products where id = p_product;
    raise exception 'Insufficient stock for "%": available %, requested %', v_name, v_qty, abs(p_delta);
  end if;
  update warehouse_stock set quantity = v_new, updated_at = now()
    where warehouse_id = p_warehouse and product_id = p_product;
  insert into stock_movements (product_id,warehouse_id,movement_type,quantity,balance_after,unit_cost,reference_type,reference_id,note,created_by)
    values (p_product,p_warehouse,p_type,p_delta,v_new,p_cost,p_ref_type,p_ref_id,p_note,p_user);
  perform sf_check_alerts(p_product);
  return v_new;
end $$;

-- Manual stock in / out / adjustment / opening stock
create or replace function sf_manual_stock(
  p_product uuid, p_warehouse uuid, p_type movement_type, p_qty numeric, p_user uuid, p_note text default null
) returns numeric language plpgsql as $$
declare v_delta numeric;
begin
  if p_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if p_type not in ('opening','stock_in','stock_out','adjustment_in','adjustment_out') then
    raise exception 'Invalid manual movement type'; end if;
  v_delta := case when p_type in ('stock_out','adjustment_out') then -p_qty else p_qty end;
  return sf_apply_stock(p_product,p_warehouse,v_delta,p_type,'manual',null,p_user,p_note,null);
end $$;

-- Receive purchase: stock + ledger + supplier balance + payment, exactly once
create or replace function sf_receive_purchase(p_purchase uuid, p_user uuid, p_paid numeric default 0, p_method text default 'cash')
returns void language plpgsql as $$
declare p purchases%rowtype; it record;
begin
  select * into p from purchases where id = p_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p.status = 'received' then raise exception 'Purchase already received'; end if;
  if p.status not in ('pending','approved') then raise exception 'Only pending or approved purchases can be received'; end if;
  if p_paid < 0 or p_paid > p.grand_total - p.paid_amount then raise exception 'Invalid payment amount'; end if;
  for it in select * from purchase_items where purchase_id = p.id order by product_id loop
    perform sf_apply_stock(it.product_id, p.warehouse_id, it.quantity, 'purchase', 'purchase', p.id, p_user, p.invoice_no, it.unit_price);
    update products set purchase_price = it.unit_price where id = it.product_id;
  end loop;
  update suppliers set current_balance = current_balance + p.grand_total - p_paid where id = p.supplier_id;
  if p_paid > 0 then
    insert into supplier_payments (supplier_id,purchase_id,amount,method,created_by) values (p.supplier_id,p.id,p_paid,p_method,p_user);
  end if;
  update purchases set status='received', received_at=now(), paid_amount = paid_amount + p_paid,
    payment_status = sf_pay_status(grand_total, paid_amount + p_paid) where id = p.id;
end $$;

-- Complete sale: check stock, deduct, snapshot cost, customer balance, payment
create or replace function sf_complete_sale(p_sale uuid, p_user uuid, p_paid numeric default 0, p_method text default 'cash')
returns void language plpgsql as $$
declare s sales%rowtype; it record; v_cost numeric;
begin
  select * into s from sales where id = p_sale for update;
  if not found then raise exception 'Sale not found'; end if;
  if s.status = 'completed' then raise exception 'Sale already completed'; end if;
  if s.status not in ('draft','confirmed') then raise exception 'Sale cannot be completed from status %', s.status; end if;
  if p_paid < 0 or p_paid > s.grand_total - s.paid_amount then raise exception 'Invalid payment amount'; end if;
  if s.customer_id is null and p_paid < s.grand_total - s.paid_amount then
    raise exception 'Walk-in sales must be paid in full'; end if;
  for it in select * from sale_items where sale_id = s.id order by product_id loop
    select purchase_price into v_cost from products where id = it.product_id;
    perform sf_apply_stock(it.product_id, s.warehouse_id, -it.quantity, 'sale', 'sale', s.id, p_user, s.invoice_no, v_cost);
    update sale_items set unit_cost = v_cost where id = it.id;
  end loop;
  if s.customer_id is not null then
    update customers set current_balance = current_balance + s.grand_total - p_paid where id = s.customer_id;
    if p_paid > 0 then
      insert into customer_payments (customer_id,sale_id,amount,method,created_by) values (s.customer_id,s.id,p_paid,p_method,p_user);
    end if;
  end if;
  update sales set status='completed', completed_at=now(), payment_method=p_method, paid_amount = paid_amount + p_paid,
    payment_status = sf_pay_status(grand_total, paid_amount + p_paid) where id = s.id;
end $$;

-- Confirm transfer: debit source, credit destination, atomically
create or replace function sf_confirm_transfer(p_transfer uuid, p_user uuid) returns void language plpgsql as $$
declare t stock_transfers%rowtype; it record;
begin
  select * into t from stock_transfers where id = p_transfer for update;
  if not found then raise exception 'Transfer not found'; end if;
  if t.status <> 'draft' then raise exception 'Transfer already %', t.status; end if;
  if not exists (select 1 from stock_transfer_items where transfer_id = t.id) then raise exception 'Transfer has no items'; end if;
  for it in select * from stock_transfer_items where transfer_id = t.id order by product_id loop
    perform sf_apply_stock(it.product_id, t.from_warehouse_id, -it.quantity, 'transfer_out', 'transfer', t.id, p_user, t.transfer_no);
    perform sf_apply_stock(it.product_id, t.to_warehouse_id,    it.quantity, 'transfer_in',  'transfer', t.id, p_user, t.transfer_no);
  end loop;
  update stock_transfers set status='confirmed', confirmed_at=now() where id = t.id;
end $$;

-- Approve return: validates eligible qty, adjusts stock and party balances
create or replace function sf_approve_return(p_return uuid, p_user uuid) returns void language plpgsql as $$
declare r returns%rowtype; it record; si sale_items%rowtype; pi purchase_items%rowtype; v_value numeric := 0; v_line numeric;
begin
  select * into r from returns where id = p_return for update;
  if not found then raise exception 'Return not found'; end if;
  if r.status <> 'pending' then raise exception 'Return already %', r.status; end if;
  for it in select * from return_items where return_id = r.id loop
    if r.kind = 'sale' then
      select * into si from sale_items where id = it.sale_item_id and sale_id = r.sale_id for update;
      if not found then raise exception 'Return item does not belong to this sale'; end if;
      if si.returned_qty + it.quantity > si.quantity then
        raise exception 'Return quantity exceeds eligible quantity (eligible: %)', si.quantity - si.returned_qty; end if;
      update sale_items set returned_qty = returned_qty + it.quantity where id = si.id;
      perform sf_apply_stock(it.product_id, r.warehouse_id, it.quantity, 'return_in', 'return', r.id, p_user, r.return_no, si.unit_cost);
      v_line := it.quantity * (si.line_total / si.quantity);
    else
      select * into pi from purchase_items where id = it.purchase_item_id and purchase_id = r.purchase_id for update;
      if not found then raise exception 'Return item does not belong to this purchase'; end if;
      if pi.returned_qty + it.quantity > pi.quantity then
        raise exception 'Return quantity exceeds eligible quantity (eligible: %)', pi.quantity - pi.returned_qty; end if;
      update purchase_items set returned_qty = returned_qty + it.quantity where id = pi.id;
      perform sf_apply_stock(it.product_id, r.warehouse_id, -it.quantity, 'return_out', 'return', r.id, p_user, r.return_no, pi.unit_price);
      v_line := it.quantity * (pi.line_total / pi.quantity);
    end if;
    v_value := v_value + v_line;
  end loop;
  if r.refund_amount > v_value then raise exception 'Refund (%) exceeds returned value (%)', r.refund_amount, round(v_value,2); end if;
  if r.kind = 'sale' then
    update customers set current_balance = current_balance - (v_value - r.refund_amount)
      where id = (select customer_id from sales where id = r.sale_id);
  else
    update suppliers set current_balance = current_balance - (v_value - r.refund_amount)
      where id = (select supplier_id from purchases where id = r.purchase_id);
  end if;
  update returns set status='approved', approved_by=p_user where id = r.id;
end $$;

-- Prevent deleting a warehouse that still holds stock
create or replace function sf_guard_warehouse_delete() returns trigger language plpgsql as $$
begin
  if exists (select 1 from warehouse_stock where warehouse_id = old.id and quantity <> 0) then
    raise exception 'Cannot delete warehouse "%": it still holds stock. Transfer or adjust it to zero first.', old.name;
  end if;
  return old;
end $$;
drop trigger if exists trg_warehouse_delete_guard on warehouses;
create trigger trg_warehouse_delete_guard before delete on warehouses for each row execute function sf_guard_warehouse_delete();

-- Only the backend (service role) may call these functions
-- Functions default to EXECUTE for PUBLIC, so revoke from PUBLIC too.
-- (sf_role() in policies.sql is created later and stays callable by RLS.)
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
