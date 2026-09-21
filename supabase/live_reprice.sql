-- ============================================================
-- LIVE REPRICE PATCH  (idempotent — safe to run more than once)
-- Run this whole file in the Supabase SQL editor.
-- Sets: 1 XENA = $0.0002 / ₦0.266, USD-derived vault deposits,
--       16.67% Micro Starter APY, repriced P2P ads, and normalizes
--       every profile's stale price fields.
-- ============================================================

-- 1) GLOBAL PRICE + NGN RATE ----------------------------------
insert into public.xena_settings (key, value) values
  ('price',         '{"price": 0.0002}'),
  ('xena_ngn_rate', '{"ngnRate": 0.266}')
on conflict (key) do update set value = excluded.value;

-- 2) ZERO-FEE P2P LISTINGS — one price rule for the whole site ------
update public.p2p_offers set price_per_xena = 0.0002;

-- 3) VAULT CATALOG — USD-derived min_deposit (min_deposit = priceUsd / price)
--    Micro Starter APY → 16.67%. All plans are 30-day lock. ------
insert into public.vault_catalog (id, name, category, apy, duration, days, min_deposit, badge, risk, description, active, sort_order) values
  ('cat-flex',    'Micro Starter',  'Flexible',      16.67, '30-Day Lock', 30, 15000,  'Instant Redeem', 'Low Risk',   'A tiny low-pressure entry point. Yield compounds daily; funds unlock after the 30-day lock.', true, 1),
  ('cat-2wk-sprint','2-Week Sprint','2-Week (14D)',  20.0, '30-Day Lock', 30, 50000,  '⚡ 2-Week',      'Audited',    'A friendly APY boost on your starter amount. Funds unlock after the 30-day lock.', true, 2),
  ('cat-2wk-surge','2-Week Surge',  '2-Week (14D)',  24.0, '30-Day Lock', 30, 75000,  'High Yield',     'Protected',  'Proof-of-stake delegation with compounding and payout at maturity (30-day lock).', true, 3),
  ('cat-30d',     '30-Day Growth',  'Fixed Term',    28.0, '30-Day Lock', 30, 115000, 'Popular',        'Audited Strategy', 'A balanced vault routing liquidity for steady amplified yield. 30-day lock.', true, 4),
  ('cat-45d',     '45-Day Momentum','Fixed Term',    34.0, '30-Day Lock', 30, 175000, 'Trending',       'Hedged',     'A mid-term play blending validator yield with defensive hedging. 30-day lock.', true, 5),
  ('cat-90d',     'VIP Boost',      'VIP Tier',      42.0, '30-Day Lock', 30, 200000, 'High APY',       'Protected',  'The top tier — institutional revenue share with maximum compounding power. 30-day lock.', true, 6)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, apy = excluded.apy,
  duration = excluded.duration, days = excluded.days, min_deposit = excluded.min_deposit,
  badge = excluded.badge, risk = excluded.risk, description = excluded.description,
  active = excluded.active, sort_order = excluded.sort_order;

-- 4) NORMALIZE EVERY PROFILE'S BALANCES -------------------------
--    Stored per-profile prices went stale (usdRate was 1, currentPrice 2.85,
--    xenaNgnRate 1500). Force them to the live global price so wallets,
--    holdings and charts all agree. -----------------------------
update public.profiles
  set balances = jsonb_set(
        jsonb_set(jsonb_set(balances, '{currentPrice}', '0.0002'::jsonb), '{usdRate}', '0.0002'::jsonb),
        '{xenaNgnRate}', '0.266'::jsonb),
      updated_at = now()
  where balances is not null;

--    Historic average buy price from the $2.15 era is nonsense at $0.0002.
update public.profiles
  set balances = jsonb_set(balances, '{averageBuyPrice}', '0.0002'::jsonb),
      updated_at = now()
  where balances is not null and (balances->>'averageBuyPrice')::numeric > 1;

-- 5) REFRESH FUNCTIONS (from migration.sql) ---------------------

-- admin_set_price: 4-decimal NGN rate (0.266 must not round to 0.27)
-- and now also writes usdRate so per-profile fiat matches the market.
create or replace function public.admin_set_price(p_price numeric, p_ngn_rate numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p numeric := round(p_price, 4); r numeric := round(coalesce(p_ngn_rate, 0.266), 4);
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if p is null or p <= 0 then return jsonb_build_object('ok', false, 'error', 'Enter a valid price greater than 0.'); end if;
  if r <= 0 then return jsonb_build_object('ok', false, 'error', 'Enter a valid NGN rate greater than 0.'); end if;
  insert into public.xena_settings(key, value) values ('price', jsonb_build_object('price', p))
    on conflict (key) do update set value = excluded.value;
  insert into public.xena_settings(key, value) values ('xena_ngn_rate', jsonb_build_object('ngnRate', r))
    on conflict (key) do update set value = excluded.value;
  update public.p2p_offers set price_per_xena = p;
  update public.profiles
    set balances = jsonb_set(
          jsonb_set(jsonb_set(balances, '{currentPrice}', to_jsonb(p)), '{usdRate}', to_jsonb(p)),
          '{xenaNgnRate}', to_jsonb(r)),
        updated_at = now()
    where balances is not null;
  return jsonb_build_object('ok', true, 'price', p, 'xenaNgnRate', r);
end $$;

-- user_stake_vault: one purchase per plan (duplicate-stake guard).
create or replace function public.user_stake_vault(p_vault_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  p public.profiles%rowtype;
  v_cat public.vault_catalog%rowtype;
  v_amt numeric;
  tx jsonb;
  notif jsonb;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select * into v_cat from public.vault_catalog where id = p_vault_id and active = true;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'This vault is unavailable.'); end if;
  -- Each plan can only be held once: block a duplicate stake while the user
  -- already has an active (unmatured) position in this vault.
  if exists (select 1 from public.investments where user_id = u and plan_name = v_cat.name and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'You already hold this plan. Each plan can only be purchased once.');
  end if;
  select * into p from public.profiles where id = u;
  v_amt := coalesce(v_cat.min_deposit, 0);
  if v_amt <= 0 then v_amt := 1; end if;
  if (p.balances->>'availableXena')::numeric < v_amt then
    return jsonb_build_object('ok', false, 'error', 'Insufficient available XENA to stake this plan.');
  end if;
  tx := jsonb_build_object(
    'id', 'tx-stake-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Staked in ' || v_cat.name,
    'type', 'yield',
    'amount', v_amt,
    'unit', 'XENA',
    'timestamp', 'Just now',
    'status', 'Completed',
    'paymentMethod', 'Vault: ' || v_cat.category,
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-stake-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Vault Staked',
    'message', v_amt || ' XENA staked into ' || v_cat.name || ' (' || v_cat.apy || '% APY).',
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric - v_amt)::numeric::text::jsonb),
      '{investedXena}',
      ((balances->>'investedXena')::numeric + v_amt)::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where id = u;

  insert into public.investments (user_id, email, user_name, plan_name, category, invested_xena, apy, total_days, days_remaining, progress_percent, status, started_at)
  values (u, p.email, p.name, v_cat.name, v_cat.category, v_amt, v_cat.apy, v_cat.days, v_cat.days, 0, 'active', now());

  return jsonb_build_object('ok', true, 'investment', (select to_jsonb(i) from public.investments i
    where i.user_id = u order by i.created_at desc limit 1));
end $$;

-- 6) RE-SYNC PUBLIC STATE ---------------------------------------
select public.get_public_state();