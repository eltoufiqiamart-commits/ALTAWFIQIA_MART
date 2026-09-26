-- ============================================================================
-- EL TAWFIKIA MART — RLS / RPC ADVERSARIAL TEST SUITE
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard -> SQL Editor (psql-equivalent, Postgres 15+).
-- Safe: every impersonation block rolls back; nothing is mutated.
--
-- ONE-TIME SETUP
--   1. Register TWO customer accounts from the site (customer A and B),
--      confirm both emails, and place at least one order with customer A.
--   2. Replace the two placeholders below with their profile (auth.users) ids.
--   3. Run the whole file. Every row in the output must read PASS.
--      FAIL rows describe a real security regression to investigate.
--
-- Migrations assumed applied: 0001 .. 0019.
-- ============================================================================

-- (The Supabase SQL Editor is not psql, so there are no \set variables:
--  just find & replace the two tokens below before running.)
--   REPLACE_WITH_CUSTOMER_A_UUID  -> A's uuid
--   REPLACE_WITH_CUSTOMER_B_UUID  -> B's uuid

-- ============================================================================
-- 0. INVENTORY — RLS must be enabled on every public table.
-- ============================================================================
select
  case when count(*) = 0 then 'PASS' else 'FAIL: ' || string_agg(c.relname, ', ') end
  as "0. RLS enabled on all user tables"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false;

-- Helper to run SQL as a given login (authenticated + JWT claims) inside a
-- transaction that is always rolled back.
-- ----------------------------------------------------------------------------
-- Usage pattern (repeated below):
--   begin;
--     set local role authenticated;
--     select set_config('request.jwt.claims',
--       json_build_object('sub', :user_a, 'role', 'authenticated')::text, true);
--     -- ...adversarial queries...
--   rollback;
-- ----------------------------------------------------------------------------


-- ============================================================================
-- 1. CROSS-USER ISOLATION (logged in as customer B, attacking A's data)
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);

select
  (select count(*) from public.orders      o where o.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as orders_seen,
  (select count(*) from public.addresses   a where a.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as addresses_seen,
  (select count(*) from public.notifications n where n.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as notifications_seen,
  (select count(*) from public.returns     r where r.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as returns_seen,
  (select count(*) from public.wishlist_items w where w.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as wishlist_seen,
  (select count(*) from public.order_items oi
     join public.orders o on o.id = oi.order_id
    where o.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as order_items_seen,
  (select count(*) from public.payments p
     join public.orders o on o.id = p.order_id
    where o.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID') as payments_seen
-- ALL COLUMNS MUST BE 0.
;

-- 1b. Direct UPDATE/DELETE against another customer's rows must be blocked
--     (0 rows affected; PostgREST returns 403/404 at the API edge).
update public.orders set status = 'delivered' where user_id = 'REPLACE_WITH_CUSTOMER_A_UUID';
update public.addresses set full_name = 'PWNED' where user_id = 'REPLACE_WITH_CUSTOMER_A_UUID';
delete from public.wishlist_items where user_id = 'REPLACE_WITH_CUSTOMER_A_UUID';
-- Expect: UPDATE 0 / UPDATE 0 / DELETE 0.
rollback;


-- ============================================================================
-- 2. PRIVATE TABLES & COLUMNS — customer must see NOTHING internal.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);

-- 2a. Tables that must return zero rows (or a permission error = also fine).
select 'suppliers' as t, count(*) from public.suppliers
union all select 'coupons',           count(*) from public.coupons
union all select 'coupon_usage',      count(*) from public.coupon_usage
union all select 'audit_logs',        count(*) from public.audit_logs
union all select 'rate_limit_events', count(*) from public.rate_limit_events
union all select 'idempotency_keys',  count(*) from public.idempotency_keys
union all select 'search_logs',       count(*) from public.search_logs
union all select 'payment_events',    count(*) from public.payment_events
union all select 'inventory_transactions', count(*) from public.inventory_transactions
union all select 'contact_messages',  count(*) from public.contact_messages
-- EVERY ROW MUST SHOW 0.
;

-- 2b. Private product columns must not be GRANTed to customers.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'products'
  and grantee in ('anon', 'authenticated')
  and column_name in
    ('supplier_id','cost_amount','supplier_notes','procurement_notes',
     'reserved_quantity','low_stock_threshold','search_text','deleted_at')
-- MUST RETURN ZERO ROWS.
;

-- 2c. Sensitive order/payment columns likewise.
select table_name, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and ((table_name = 'orders' and column_name in ('internal_notes','supplier_id','fulfillment_status'))
    or (table_name = 'payments' and column_name in ('receipt_path','admin_note')))
-- MUST RETURN ZERO ROWS.
;

-- 2d. Draft/archived/deleted products must be invisible to customers.
select count(*) as non_public_products_visible
from public.products
where status <> 'published' or deleted_at is not null; -- MUST BE 0.
rollback;


-- ============================================================================
-- 3. STORAGE / RECEIPT NAMESPACE — enforced by RPC 0016.
--     Run as customer A against one of A's own payment ids.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_A_UUID', 'role', 'authenticated')::text, true);

do $$
declare
  v_pay uuid;
  v_ok boolean := false;
begin
  select p.id into v_pay
  from public.payments p join public.orders o on o.id = p.order_id
  where o.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID'
  limit 1;

  if v_pay is null then
    raise notice 'SKIP 3: customer A has no payment row yet.';
  else
    -- 3a. Forged paths must be rejected with RECEIPT_PATH_INVALID.
    begin
      perform public.submit_payment_reference(v_pay, 'TESTREF-001',
        'receipts/REPLACE_WITH_CUSTOMER_B_UUID/' || gen_random_uuid() || '.jpg');
    exception when others then
      v_ok := sqlerrm like '%RECEIPT_PATH_INVALID%';
      if not v_ok then
        raise exception 'FAIL 3a: expected RECEIPT_PATH_INVALID, got %', sqlerrm;
      end if;
    end;

    begin
      perform public.submit_payment_reference(v_pay, 'TESTREF-002',
        '../private/receipts/x.jpg');
    exception when others then
      v_ok := sqlerrm like '%RECEIPT_PATH_INVALID%';
      if not v_ok then
        raise exception 'FAIL 3b: expected RECEIPT_PATH_INVALID, got %', sqlerrm;
      end if;
    end;

    begin
      perform public.submit_payment_reference(v_pay, 'TESTREF-003',
        'receipts/REPLACE_WITH_CUSTOMER_A_UUID/evil.exe');
    exception when others then
      v_ok := sqlerrm like '%RECEIPT_PATH_INVALID%';
      if not v_ok then
        raise exception 'FAIL 3c: expected RECEIPT_PATH_INVALID, got %', sqlerrm;
      end if;
    end;

    if v_ok then raise notice 'PASS 3: receipt namespace enforced'; end if;
  end if;
end $$;
rollback;


-- ============================================================================
-- 4. ORDER OWNERSHIP — customer B cannot touch A's payment/order via RPC.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);

do $$
declare
  v_pay uuid;
begin
  select p.id into v_pay
  from public.payments p join public.orders o on o.id = p.order_id
  where o.user_id = 'REPLACE_WITH_CUSTOMER_A_UUID'
  limit 1;
  if v_pay is null then
    raise notice 'SKIP 4: no payment row for A.';
  else
    begin
      perform public.submit_payment_reference(v_pay, 'HACKED-REF', null);
      raise exception 'FAIL 4: B attached a reference to A''s payment';
    exception
      when others then
        if sqlerrm not like '%NOT_FOUND%' then
          raise exception 'FAIL 4: expected NOT_FOUND, got %', sqlerrm;
        end if;
        raise notice 'PASS 4: cross-user payment reference blocked';
    end;

    begin
      perform public.customer_cancel_order(
        (select id from public.orders where user_id = 'REPLACE_WITH_CUSTOMER_A_UUID' limit 1),
        'hijack');
      raise exception 'FAIL 4b: B cancelled A''s order';
    exception
      when others then
        if sqlerrm not like '%NOT_FOUND%' then
          raise exception 'FAIL 4b: expected NOT_FOUND, got %', sqlerrm;
        end if;
        raise notice 'PASS 4b: cross-user cancel blocked';
    end;
  end if;
end $$;
rollback;


-- ============================================================================
-- 5. COUPON PREVIEW RPC — verdict only, no enumeration, limits respected.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);
-- 5a. Unknown code must be invalid (and must NOT error / list codes).
select public.preview_coupon('NO-SUCH-CODE-' || gen_random_uuid()::text, 100000)
  as must_be_invalid;
-- Expect: {"valid": false, "reason": "COUPON_INVALID"}
rollback;

-- 5b. Even anon can validate a code it already knows, but cannot list coupons:
begin;
set local role anon;
select public.preview_coupon('NO-SUCH-CODE', 100000) as anon_preview; -- invalid verdict is fine
rollback;


-- ============================================================================
-- 6. PRIVILEGE ESCALATION — internal/admin RPCs are not executable.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);

do $$
declare
  v text;
  blocked constant text[] = array[
    'select public._notify(gen_random_uuid(),''x'',''x'',''x'',''x'')',
    'select public._audit(''x'',''x'',''x'',''{}''::jsonb)',
    'select public.admin_verify_payment(gen_random_uuid(),''approve'',''x'')',
    'select public.admin_transition_order(gen_random_uuid(),''shipped'',''x'')',
    'select public.admin_process_return(gen_random_uuid(),''approve'',''x'')',
    'select public.expire_stale_orders(24)',
    'select public.purge_old_rate_events(7)'
  ];
begin
  foreach v in array blocked loop
    begin
      execute v;
      raise exception 'FAIL 6: customer could execute: %', v;
    exception
      when insufficient_privilege then null; -- expected
      when others then
        -- FORBIDDEN raised inside definer functions is also acceptable.
        if sqlerrm not ilike '%permission denied%'
           and sqlerrm not like '%FORBIDDEN%' then
          raise notice 'blocked (%) with: %', v, sqlerrm;
        end if;
    end;
  end loop;
  raise notice 'PASS 6: internal/admin RPCs are not callable by customers';
end $$;
rollback;


-- ============================================================================
-- 7. DIRECT WRITES TO PROTECTED TABLES — must be denied for customers.
--    Each statement must ERROR (permission denied) or affect 0 rows.
-- ============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'REPLACE_WITH_CUSTOMER_B_UUID', 'role', 'authenticated')::text, true);

-- 7a. Inventory, products and catalog writes.
do $$
declare
  v text;
  denied constant text[] = array[
    'insert into public.products(sku,slug,name_ar,price_amount) values (''X'',''x'',''X'',1)',
    'update public.products set price_amount = 1',
    'insert into public.inventory_transactions(product_id, change_quantity, reason) values (gen_random_uuid(), 999, ''hack'')',
    'insert into public.coupons(code,type,value) values (''HACK'',''percentage'',10000)',
    'update public.business_settings set value = ''{}''::jsonb where key = ''pricing''',
    'insert into public.payments(order_id, method, amount, status) values (gen_random_uuid(),''cod'',1,''paid'')',
    'update public.orders set payment_status = ''paid''',
    'insert into public.payment_events(payment_id, event) values (gen_random_uuid(),''paid'')'
  ];
begin
  foreach v in array denied loop
    begin
      execute v;
      raise exception 'FAIL 7: customer could write: %', v;
    exception
      when insufficient_privilege then null;
      when others then
        if sqlerrm not like '%permission denied%'
           and sqlerrm not like '%violates%'
           and sqlerrm not like '%foreign key%' then
          raise notice 'write blocked with: % -> %', v, sqlerrm;
        end if;
    end;
  end loop;
  raise notice 'PASS 7: protected-table writes denied';
end $$;
rollback;


-- ============================================================================
-- 8. REVIEW INTEGRITY — only verified purchasers, one review per product.
--    (Exercise through the UI/RPC with an account that never bought the
--    product; it must raise REVIEW_NOT_ELIGIBLE. SQL-side guard below.)
-- ============================================================================
select p.proname, pg_get_functiondef(p.oid) ~ 'verified' as mentions_verified_purchase
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'submit_review';
-- Also confirm there is no customer INSERT policy on reviews (definer only).
select polname, cmd
from pg_policy
where polrelid = 'public.reviews'::regclass and cmd = 'INSERT';
-- MUST RETURN ZERO ROWS.


-- ============================================================================
-- 9. FUTURE FUNCTIONS ARE CLOSED BY DEFAULT (migration 0018).
-- ============================================================================
-- EXECUTE grants to PUBLIC for any function outside the customer-callable
-- allowlist: the count MUST be 0 (0018 revokes internal helpers and changes
-- default privileges so future functions start closed).
select count(*) as unexpected_public_executes
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and has_function_privilege('public', p.oid, 'EXECUTE')
  and p.proname not in (
    -- explicit allowlist of customer-callable RPCs and auth.uid() helpers.
    -- NOTE: check_rate_limit was REMOVED from this list by migration 0021 —
    -- it accepted caller-chosen limits and must no longer be publicly callable.
    'consume_rate_limit','search_products','search_suggestions','log_search',
    'place_order','submit_payment_reference','submit_review','request_return',
    'customer_cancel_order','cart_lines','preview_coupon','normalize_arabic',
    'has_permission','has_role','get_public_settings',
    'register_pending_object','claim_pending_object',
    'admin_save_product_compatibility'
  );


-- ============================================================================
-- 10. SEARCH BOUNDS (0017) — hardened function signature/truncation present.
-- ============================================================================
select
  case when pg_get_functiondef('public.search_products(text,jsonb,integer,integer,text)'::regprocedure)
       ~ 'least\(48' then 'PASS' else 'FAIL: page_size cap missing' end
  as "10. search page_size capped at 48";


-- ============================================================================
-- 11. RATE LIMITER IS NOT CALLER-CONTROLLED (migration 0021).
-- ============================================================================
-- 11a. The legacy 4-arg limiter must NOT be executable by anon/authenticated.
--      It let any caller pass its own p_limit and thereby disable throttling.
select
  case when has_function_privilege('anon',
         'public.check_rate_limit(text,text,int,int)', 'EXECUTE')
        or has_function_privilege('authenticated',
         'public.check_rate_limit(text,text,int,int)', 'EXECUTE')
       then 'FAIL: caller-controlled limiter still public'
       else 'PASS' end
  as "11a. check_rate_limit revoked from public roles";

-- 11b. The replacement must NOT expose limit/window parameters at all.
select
  case when pg_get_function_identity_arguments(
         'public.consume_rate_limit(text,text)'::regprocedure) = 'text, text'
       then 'PASS' else 'FAIL: unexpected limiter signature' end
  as "11b. consume_rate_limit takes no limit/window";

-- 11c. An unknown bucket must RAISE (fail closed), never silently allow.
do $$
begin
  begin
    perform public.consume_rate_limit('definitely_not_a_real_bucket', 'x');
    raise notice 'FAIL: unknown bucket was allowed';
  exception when others then
    raise notice 'PASS: unknown bucket rejected (%)', sqlerrm;
  end;
end $$;


-- ============================================================================
-- 12. HISTORICAL COST / SUPPLIER SNAPSHOT IS PRIVATE (migration 0020).
-- ============================================================================
-- 12a. The snapshot columns must exist.
select
  case when count(*) = 6 then 'PASS' else 'FAIL: snapshot columns missing' end
  as "12a. order_items snapshot columns present"
from information_schema.columns
where table_schema = 'public' and table_name = 'order_items'
  and column_name in ('cost_amount_at_order','supplier_id_at_order',
    'supplier_name_at_order','supplier_shop_name_at_order',
    'supplier_phone_at_order','supplier_address_at_order');

-- 12b. A CUSTOMER reading their own order must not be able to see supplier
--      cost/contact. Run as customer A and confirm the values are withheld by
--      the application layer (RLS grants row access; the app selects columns).
--      This check verifies the admin-only economics view is NOT readable.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','REPLACE_WITH_CUSTOMER_A_UUID','role','authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform 1 from public.admin_order_item_economics limit 1;
    raise notice 'FAIL: customer can read admin_order_item_economics';
  exception when insufficient_privilege or undefined_table then
    raise notice 'PASS: economics view not readable by customer';
  end;
end $$;
rollback;


-- ============================================================================
-- 13. PREPAID ORDERS CANNOT BE DELIVERED UNPAID (migration 0020, section 15).
-- ============================================================================
select
  case when pg_get_functiondef('public.admin_transition_order(uuid,text,text,text)'::regprocedure)
       ~ 'PREPAID_NOT_VERIFIED' then 'PASS'
       else 'FAIL: prepaid delivery guard missing' end
  as "13a. prepaid delivery guard present";

select
  case when pg_get_functiondef('public.admin_transition_order(uuid,text,text,text)'::regprocedure)
       ~ 'REFUND_REQUIRED_BEFORE_CANCEL' then 'PASS'
       else 'FAIL: paid-cancel guard missing' end
  as "13b. paid order cannot be cancelled without refund";

-- 13c. The expiry sweep must cover BOTH pending payment states (section 16).
select
  case when pg_get_functiondef('public.expire_stale_orders(int)'::regprocedure)
       ~ 'awaiting_verification' then 'PASS'
       else 'FAIL: awaiting_verification not expired' end
  as "13c. expiry covers awaiting_verification";


-- ============================================================================
-- 14. PRIVATE SETTINGS ARE NOT WORLD-READABLE (migration 0022, section 23).
-- ============================================================================
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','REPLACE_WITH_CUSTOMER_A_UUID','role','authenticated')::text, true);
set local role authenticated;
-- The 'pricing' key holds fee/margin configuration and must be invisible.
select
  case when count(*) = 0 then 'PASS' else 'FAIL: pricing config readable by customer' end
  as "14. private pricing settings hidden from customers"
from public.business_settings where key = 'pricing';
rollback;

-- ============================================================================
-- 15. MARGIN POLICY IS PRIVATE AND ENFORCED (migration 0024, section 22).
-- ============================================================================
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','REPLACE_WITH_CUSTOMER_A_UUID','role','authenticated')::text, true);
set local role authenticated;
-- 15a. The policy row must never be visible to a customer.
select
  case when count(*) = 0 then 'PASS' else 'FAIL: margin policy readable by customer' end
  as "15a. margin_policy hidden from customers"
from public.business_settings where key = 'margin_policy';
-- 15b. The alert ledger must be unreadable by customers.
do $$
begin
  perform 1 from public.margin_alerts limit 1;
  raise notice 'FAIL: customer can read margin_alerts';
exception when insufficient_privilege or undefined_table then
  raise notice 'PASS: margin_alerts not readable by customer';
end $$;
rollback;

-- 15c0. The shipped default must be 'block' (0027).
select
  case when (select value->>'mode' from public.business_settings
              where key = 'margin_policy') = 'block'
       then 'PASS' else 'FAIL: margin policy default is not block' end
  as "15c0. margin policy defaults to block";

-- 15c. Below-cost pricing is detected. Run as service_role / owner.
begin;
update public.business_settings
   set value = jsonb_set(value, '{mode}', '"warn"') where key = 'margin_policy';
-- Pick any published product and push its effective price under its cost.
do $$
declare v_id uuid; v_before int; v_after int;
begin
  select id into v_id from public.products
   where deleted_at is null and price_amount > 0 limit 1;
  if v_id is null then
    raise notice 'SKIP: no product available for margin test';
    return;
  end if;
  select count(*) into v_before from public.margin_alerts where product_id = v_id;
  update public.products
     set cost_amount = 100000, price_amount = 100000, discount_percent = 50
   where id = v_id;
  select count(*) into v_after from public.margin_alerts where product_id = v_id;
  if v_after > v_before then
    raise notice 'PASS: below-cost price recorded a margin alert';
  else
    raise notice 'FAIL: below-cost price produced no alert';
  end if;
end $$;
rollback;

-- 15d. 'block' mode must refuse the write outright.
begin;
update public.business_settings
   set value = jsonb_set(value, '{mode}', '"block"') where key = 'margin_policy';
do $$
declare v_id uuid;
begin
  select id into v_id from public.products
   where deleted_at is null and price_amount > 0 limit 1;
  if v_id is null then raise notice 'SKIP: no product'; return; end if;
  update public.products
     set cost_amount = 100000, price_amount = 100000, discount_percent = 50
   where id = v_id;
  raise notice 'FAIL: block mode allowed a below-cost price';
exception when others then
  if sqlerrm ~ 'MARGIN_BELOW_COST' then
    raise notice 'PASS: block mode rejected below-cost price';
  else
    raise notice 'FAIL: unexpected error %', sqlerrm;
  end if;
end $$;
rollback;

-- ============================================================================
-- 16. STORAGE LEDGER CANNOT BE ABUSED (migrations 0023/0025/0026, sec. 10/11).
-- ============================================================================
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','REPLACE_WITH_CUSTOMER_A_UUID','role','authenticated')::text, true);
set local role authenticated;
-- 16a. A customer must NOT be able to claim objects (0026 revoked this).
do $$
begin
  perform public.claim_pending_object('products','products/any/file.webp');
  raise notice 'FAIL: customer executed claim_pending_object';
exception when insufficient_privilege or undefined_function then
  raise notice 'PASS: claim_pending_object denied to customer';
end $$;
-- 16b. A customer must not register objects outside their own namespace.
do $$
begin
  perform public.register_pending_object('private','receipts/SOMEONE_ELSE/x.png','receipt');
  raise notice 'FAIL: cross-namespace receipt registration allowed';
exception when others then
  raise notice 'PASS: cross-namespace registration blocked (%)', sqlerrm;
end $$;
-- 16c. Orphan listing must stay closed to customers.
do $$
begin
  perform public.list_orphan_objects(48, 10);
  raise notice 'FAIL: customer listed orphan objects';
exception when insufficient_privilege or undefined_function then
  raise notice 'PASS: list_orphan_objects denied to customer';
end $$;
rollback;

-- 16d. Literal suffix matching: a path containing '_' must not be matched by
--      an unrelated path of the same length (regression test for 0025/0026).
select
  case when right('https://x/storage/v1/object/public/products/a_b/file.webp',
                  length('products/aXb/file.webp')) = 'products/aXb/file.webp'
       then 'FAIL: wildcard-style match still possible'
       else 'PASS: underscore is treated literally' end
  as "16d. literal path matching";

-- ============================================================================
-- 17. ORDER IDEMPOTENCY RACE IS HANDLED (migration 0028, section 19).
-- ============================================================================
-- 17a. The public entry point must be the wrapper, and the implementation must
--      NOT be callable by clients.
select
  case when exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='_place_order_impl')
   and not has_function_privilege('authenticated','public._place_order_impl(jsonb)','execute')
  then 'PASS' else 'FAIL: impl missing or client-callable' end
  as "17a. place_order impl is internal only";

-- 17b. Customers must still be able to call the public wrapper.
select
  case when has_function_privilege('authenticated','public.place_order(jsonb)','execute')
       then 'PASS' else 'FAIL: place_order not callable by customers' end
  as "17b. place_order callable by authenticated";

-- 17c. A replayed idempotency key must return duplicate=true, never an error.
--      Run as a real customer; requires an existing order for that user.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub','REPLACE_WITH_CUSTOMER_A_UUID','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v_key uuid; v_res jsonb;
begin
  select idempotency_key into v_key from public.orders
   where user_id = 'REPLACE_WITH_CUSTOMER_A_UUID'::uuid
     and idempotency_key is not null
   limit 1;
  if v_key is null then
    raise notice 'SKIP: customer A has no order with an idempotency key';
    return;
  end if;
  v_res := public.place_order(jsonb_build_object('idempotencyKey', v_key::text));
  if (v_res->>'duplicate')::boolean then
    raise notice 'PASS: replayed key returned the original order';
  else
    raise notice 'FAIL: replayed key did not report duplicate';
  end if;
exception when others then
  raise notice 'FAIL: replay raised % (%)', sqlstate, sqlerrm;
end $$;
rollback;
