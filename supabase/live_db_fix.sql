-- =============================================================
-- XENA Exchange — Live DB Fix Script
-- Run this in Supabase SQL Editor (https://supabase.com → SQL)
-- It patches 4 issues:
--   1. Harden save_account_profile (block free XENA exploit)
--   2. Add redeem_promo_code RPC (server-side promo validation)
--   3. Seed server-side promo codes into xena_settings
--   4. Fix admin/login identities for seeded auth.users
-- =============================================================

-- 1) HARDEN save_account_profile — only whitelisted user fields
--    Balances, transactions, redeemed_bonus_codes are SERVER-OWNED.
create or replace function public.save_account_profile(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  update public.profiles set
    notifications = coalesce(payload->'notifications', notifications),
    two_factor_enabled = coalesce((payload->'twoFactorEnabled')::boolean, two_factor_enabled),
    pin_set = coalesce((payload->'pinSet')::boolean, pin_set),
    bank_details = coalesce(payload->'bankDetails', bank_details),
    wallet_addresses = coalesce(payload->'walletAddresses', wallet_addresses),
    name = coalesce(payload->>'name', name),
    country = coalesce(payload->>'country', country),
    phone = coalesce(payload->>'phone', phone),
    dob = coalesce(payload->>'dob', dob),
    updated_at = now()
  where id = u;
  return jsonb_build_object('ok', true);
end $$;


-- 2) REDEEM PROMO CODE — server-side validation, one claim per code per user
create or replace function public.redeem_promo_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_code text;
  v_promos jsonb;
  v_promo jsonb;
  v_reward numeric;
  v_label text;
  v_used boolean := false;
  tx jsonb;
  notif jsonb;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code = '' then return jsonb_build_object('ok', false, 'error', 'Please enter a bonus or voucher code to redeem.'); end if;

  select value into v_promos from public.xena_settings where key = 'promos';
  if v_promos is null then return jsonb_build_object('ok', false, 'error', 'No bonus codes are available right now.'); end if;

  select e into v_promo
  from jsonb_array_elements(v_promos) e
  where upper(e->>'code') = v_code and coalesce((e->>'active')::boolean, true)
  limit 1;

  if v_promo is null then return jsonb_build_object('ok', false, 'error', 'Invalid or expired code "' || v_code || '". Please verify your voucher code.'); end if;

  v_reward := coalesce((v_promo->>'rewardXena')::numeric, 0);
  v_label := coalesce(v_promo->>'label', v_promo->>'description', 'Promo Bonus');
  if v_reward <= 0 then return jsonb_build_object('ok', false, 'error', 'Invalid or expired code "' || v_code || '".'); end if;

  select true into v_used from public.profiles where id = u and redeemed_bonus_codes @> to_jsonb(v_code)::jsonb;
  if v_used then return jsonb_build_object('ok', false, 'error', 'Bonus code "' || v_code || '" has already been claimed on this account.'); end if;

  tx := jsonb_build_object(
    'id', 'tx-promo-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Redeemed Promo Code: ' || v_code,
    'type', 'yield',
    'amount', v_reward,
    'unit', 'XENA',
    'status', 'Completed',
    'timestamp', 'Just now',
    'paymentMethod', 'Promo Code',
    'counterparty', 'XENA Community Reward Desk',
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-promo-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Bonus Voucher Claimed!',
    'message', '+' || v_reward::text || ' XENA has been credited to your available balance via promo code ' || v_code || '.',
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );

  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + v_reward)::numeric::text::jsonb),
      '{totalBalance}',
      ((balances->>'totalBalance')::numeric + v_reward)::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    redeemed_bonus_codes = redeemed_bonus_codes || to_jsonb(v_code),
    updated_at = now()
  where id = u;

  return jsonb_build_object('ok', true, 'amount', v_reward, 'code', v_code, 'title', 'Redeemed Promo Code: ' || v_code, 'label', v_label);
end $$;

grant execute on function public.redeem_promo_code to authenticated;


-- 3) SEED SERVER-SIDE PROMO CODES (safe to re-run)
insert into public.xena_settings (key, value) values
  ('promos', jsonb_build_array(
    jsonb_build_object('code', 'WELCOME50', 'rewardXena', 50, 'label', 'New Trader Welcome Gift', 'description', 'New Trader Welcome Gift', 'active', true),
    jsonb_build_object('code', 'XENABONUS', 'rewardXena', 25, 'label', 'Community Trading Booster Voucher', 'description', 'Community Trading Booster Voucher', 'active', true),
    jsonb_build_object('code', 'VIP100', 'rewardXena', 100, 'label', 'VIP Staker Institutional Voucher', 'description', 'VIP Staker Institutional Voucher', 'active', true),
    jsonb_build_object('code', 'P2PZERO', 'rewardXena', 15, 'label', 'P2P Trading Subsidy & Liquidity Bonus', 'description', 'P2P Trading Subsidy & Liquidity Bonus', 'active', true)
  ))
on conflict (key) do update set value = excluded.value;


-- 4) FIX ADMIN LOGIN — insert missing auth.identities rows for seeded users
-- The seed.sql inserted auth.users rows without matching auth.identities,
-- which causes GoTrue "Database error querying schema" on login.
-- This fixes admin12345@gmail.com and alex.morgan@xena.fi.

-- 4a) admin12345@gmail.com (auth.users id = 0edf38b2-ccf7-4d80-a5c1-4990ac1c2156)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email)
select
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now(),
  u.email
from auth.users u
where lower(u.email) = 'admin12345@gmail.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 4b) alex.morgan@xena.fi (auth.users id = 1410b37d-5495-41cd-852c-fa81304af8dd)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email)
select
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now(),
  u.email
from auth.users u
where lower(u.email) = 'alex.morgan@xena.fi'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- Done. After running this script:
--   - Promo code redemption is server-validated (RPC redeem_promo_code)
--   - Client can no longer write balances/transactions/redeemed codes via save_account_profile
--   - Admin login (admin12345@gmail.com / admin12345) should work via Supabase auth
--   - Showcase login (alex.morgan@xena.fi / xena-user-demo) should work via Supabase auth
