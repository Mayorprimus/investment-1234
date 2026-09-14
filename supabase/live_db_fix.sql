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
    kyc_tier = coalesce(payload->>'kycTier', kyc_tier),
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

-- 2b) ADMIN PROMO CODE SYNC RPC (admin portal promo toggles/deletes update the
--     server-side redeemable codes in xena_settings 'promos')
create or replace function public.admin_replace_promos(items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_promos jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if items is null or jsonb_typeof(items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'Invalid payload'); end if;
  select jsonb_agg(jsonb_build_object(
    'code', upper(coalesce(e->>'code', '')),
    'rewardXena', coalesce((e->>'rewardXena')::numeric, (e->>'value')::numeric, 0),
    'label', coalesce(e->>'label', e->>'description', 'Promo Bonus'),
    'description', coalesce(e->>'description', e->>'label', 'Promo Bonus'),
    'active', coalesce((e->>'active')::boolean, true)
  ))
  from jsonb_array_elements(items) e
  where coalesce(e->>'code', '') <> ''
  into v_promos;
  if v_promos is null then v_promos := '[]'::jsonb; end if;
  insert into public.xena_settings(key, value) values ('promos', v_promos)
    on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true, 'promos', v_promos);
end $$;

grant execute on function public.admin_replace_promos to authenticated;

-- 2c) ADMIN ANNOUNCEMENTS + SETTINGS SYNC RPCs (admin portal writes must reach
--     the public state: announcements table + xena_settings 'flags' key)
create or replace function public.admin_update_settings(p_flags jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  insert into public.xena_settings(key, value) values ('flags', p_flags)
    on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_replace_announcements(items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if items is null or jsonb_typeof(items) <> 'array' then return jsonb_build_object('ok', false, 'error', 'Invalid payload'); end if;
  delete from public.announcements;
  insert into public.announcements (id, title, date, tag, tag_color, summary, action_text, action_id, published_by, published)
  select
    coalesce(e->>'id', 'ann-' || substr(gen_random_uuid()::text, 1, 8)),
    e->>'title',
    e->>'date',
    coalesce(e->>'tag', 'News'),
    coalesce(e->>'tagColor', 'bg-emerald-50 text-[#16A34A] border-emerald-100'),
    e->>'summary',
    e->>'actionText',
    e->>'actionId',
    'admin12345@gmail.com',
    coalesce((e->'published')::boolean, true)
  from jsonb_array_elements(items) as e;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.admin_update_settings to authenticated;
grant execute on function public.admin_replace_announcements to authenticated;


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
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
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
  now()
from auth.users u
where lower(u.email) = 'admin12345@gmail.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 4b) alex.morgan@xena.fi (auth.users id = 1410b37d-5495-41cd-852c-fa81304af8dd)
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
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
  now()
from auth.users u
where lower(u.email) = 'alex.morgan@xena.fi'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- 4c) FIX NULL TOKEN COLUMNS — manually-seeded auth.users rows often leave
--     GoTrue token columns NULL (confirmation_token, recovery_token,
--     email_change, email_change_token_new, etc.). GoTrue scans these as
--     strings during password login, so NULL causes the 500
--     "Database error querying schema". Set them to '' (empty string).
do $$
declare
  cols text[] := array[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'reauthentication_token', 'phone_change', 'phone_change_token',
    'phone_change_token_new', 'phone_change_token_current'
  ];
  c text;
begin
  foreach c in array cols loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users' and column_name = c
    ) then
      execute format('update auth.users set %I = '''' where %I is null', c, c);
    end if;
  end loop;
end $$;

-- 5) SYNC ADMIN BLOB PROMO LIST with the server-side redeemable codes so the
--    admin portal's promo section shows the real, live codes.
update public.admin_state
set blob = jsonb_set(blob, '{promos}', '[
  {"id":"p1","code":"WELCOME50","value":50,"unit":"XENA","used":0,"cap":10000,"active":true},
  {"id":"p2","code":"XENABONUS","value":25,"unit":"XENA","used":0,"cap":10000,"active":true},
  {"id":"p3","code":"VIP100","value":100,"unit":"XENA","used":0,"cap":5000,"active":true},
  {"id":"p4","code":"P2PZERO","value":15,"unit":"XENA","used":0,"cap":10000,"active":true}
]'::jsonb)
where id = 1;

-- 6) CLIENT-SIDE PAYMENTS (no Vercel serverless needed)
--    The Vercel /api/* serverless functions are broken (FUNCTION_INVOCATION_TIMEOUT
--    on every route, even zero-dep ping). These RPCs replace them: the Postgres
--    `http` extension lets the DATABASE call Flutterwave/NOWPayments directly with
--    the secret key held ONLY in payment_secrets (RLS blocks clients from reading it).
--    Flow:
--      Flutterwave NGN:  client_create_flutterwave_deposit(amount) -> payment link
--                        client_verify_flutterwave_deposit(tx_ref) -> verify + credit
--      NOWPayments:      client_create_crypto_invoice(coin, usd) -> invoice
--                        client_check_crypto_deposit(payment_id) -> poll + credit
create extension if not exists http with schema extensions;

drop table if exists public.payment_secrets;
create table public.payment_secrets (
  provider text primary key,
  secret jsonb not null
);
alter table public.payment_secrets enable row level security;
drop policy if exists payment_secrets_rls on public.payment_secrets;
create policy payment_secrets_rls on public.payment_secrets for all using (false);
insert into public.payment_secrets (provider, secret) values
  ('flutterwave', jsonb_build_object(
    'secret_key', 'Fvi8PtZTXetIoZEL8YgKZUMHsuIiB4LvcBNWhJIzm5gCdYqJDeQu0iRM6jQIDabgwqLnilGTbr7zW1akP4Dnk6',
    'public_key', '286938f7-f3a4-441e-a642-14284577781d')),
  ('nowpayments', jsonb_build_object(
    'api_key', 'K5MRWVY-5ZJMF6D-G6HEZVP-2PKA30B',
    'ipn_secret', '0ZQp2S9J8EJdpnCKS6Qnn1IXipVg42cW'))
on conflict (provider) do update set secret = excluded.secret;

-- ── Flutterwave: create pending payment + get checkout link ──
create or replace function public.client_create_flutterwave_deposit(p_amount_ngn numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_email text;
  v_name text;
  v_min numeric;
  v_secret text;
  v_public text;
  v_tx_ref text;
  v_res extensions.http_response;
  v_data jsonb;
  v_link text;
begin
  perform set_config('http.timeout_msec', '20000', true);
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select email, coalesce(name, 'XENA User') into v_email, v_name from public.profiles where id = u;
  if v_email is null then return jsonb_build_object('ok', false, 'error', 'Unknown user.'); end if;
  if p_amount_ngn is null or p_amount_ngn <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid deposit amount.');
  end if;
  select coalesce((value->>'min_deposit_ngn')::numeric, 3000) into v_min
  from public.xena_settings where key = 'limits';
  if p_amount_ngn < v_min then
    return jsonb_build_object('ok', false, 'error', 'Minimum deposit is ₦' || v_min || '.');
  end if;

  select (secret->>'secret_key'), (secret->>'public_key') into v_secret, v_public
  from public.payment_secrets where provider = 'flutterwave';
  if v_secret is null or v_public is null then
    return jsonb_build_object('ok', false, 'error', 'Payment provider not configured.');
  end if;

  v_tx_ref := 'xena-' || replace(gen_random_uuid()::text, '-', '');
  v_res := extensions.http_post(
    'https://api.flutterwave.com/v3/payments',
    jsonb_build_object(
      'tx_ref', v_tx_ref,
      'amount', p_amount_ngn,
      'currency', 'NGN',
      'redirect_url', 'https://investment-1234.vercel.app/wallet?flutterwave_status=success',
      'payment_options', 'banktransfer,card,ussd',
      'customer', jsonb_build_object('email', v_email, 'name', v_name),
      'customizations', jsonb_build_object('title', 'XENA Deposit', 'description', 'Deposit via Flutterwave', 'logo', ''),
      'meta', jsonb_build_object('user_id', u)
    )::text,
    'application/json',
    'Authorization: Bearer ' || v_secret
  );
  v_data := (v_res.content)::jsonb;
  if v_data->>'status' <> 'success' then
    return jsonb_build_object('ok', false, 'error', coalesce(v_data->>'message', 'Unable to initialize Flutterwave payment.'));
  end if;
  v_link := v_data->'data'->>'link';

  perform public.record_pending_payment(v_tx_ref, 'flutterwave', p_amount_ngn, 'NGN', v_email,
    jsonb_build_object('tx_ref', v_tx_ref, 'payment_link', v_link));

  return jsonb_build_object('ok', true, 'reference', v_tx_ref, 'tx_ref', v_tx_ref,
    'payment_link', v_link, 'public_key', v_public);
end $$;

-- ── Flutterwave: verify tx_ref with Flutterwave API, credit if paid ──
create or replace function public.client_verify_flutterwave_deposit(p_tx_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_pay record;
  v_secret text;
  v_res extensions.http_response;
  v_data jsonb;
  v_tx jsonb;
  v_amount numeric;
  v_rate numeric;
  v_xena numeric;
begin
  perform set_config('http.timeout_msec', '20000', true);
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  if p_tx_ref is null or p_tx_ref = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing transaction reference.');
  end if;
  select * into v_pay from public.payments
  where provider = 'flutterwave' and reference = p_tx_ref limit 1;
  if v_pay.id is null then
    return jsonb_build_object('ok', false, 'error', 'Payment not found.');
  end if;
  if v_pay.user_id <> u then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized.');
  end if;
  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'xena', v_pay.xena);
  end if;

  select (secret->>'secret_key') into v_secret from public.payment_secrets where provider = 'flutterwave';
  if v_secret is null then return jsonb_build_object('ok', false, 'error', 'Payment provider not configured.'); end if;

  v_res := extensions.http_get(
    'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=' || p_tx_ref,
    'Authorization: Bearer ' || v_secret
  );
  if v_res.status <> 200 then
    return jsonb_build_object('ok', false, 'error', 'Payment not confirmed yet. If you paid, try again in a few seconds.');
  end if;
  v_data := (v_res.content)::jsonb;
  if v_data->>'status' <> 'success' then
    return jsonb_build_object('ok', false, 'error', coalesce(v_data->>'message', 'Payment not confirmed.'));
  end if;
  v_tx := v_data->'data';
  if v_tx->>'status' <> 'successful' then
    return jsonb_build_object('ok', false, 'error', 'Payment status: ' || coalesce(v_tx->>'status', 'unknown'));
  end if;
  v_amount := coalesce((v_tx->>'amount')::numeric, v_pay.amount);
  select coalesce((value->>'ngnRate')::numeric, 1500) into v_rate
  from public.xena_settings where key = 'xena_ngn_rate';
  v_xena := round((v_amount / v_rate) * 10000) / 10000;

  return public.credit_payment(
    v_pay.reference, 'flutterwave', v_amount, 'NGN', v_xena, v_pay.email,
    jsonb_build_object('coin', 'ngn', 'method', 'flutterwave', 'tx_ref', p_tx_ref)
  );
end $$;

-- ── NOWPayments: create invoice + record pending payment ──
create or replace function public.client_create_crypto_invoice(p_coin text, p_amount_usd numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_email text;
  v_pay_currency text;
  v_min numeric;
  v_api_key text;
  v_res extensions.http_response;
  v_inv jsonb;
  v_ref text;
begin
  perform set_config('http.timeout_msec', '20000', true);
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  v_pay_currency := case lower(p_coin)
    when 'usdt' then 'usdttrc20'
    when 'btc' then 'btc'
    when 'sol' then 'sol'
    when 'eth' then 'eth'
    else null end;
  if v_pay_currency is null then return jsonb_build_object('ok', false, 'error', 'Unsupported coin.'); end if;
  if p_amount_usd is null or p_amount_usd <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid deposit amount.');
  end if;
  select email into v_email from public.profiles where id = u;
  if v_email is null then return jsonb_build_object('ok', false, 'error', 'Unknown user.'); end if;
  select coalesce((value->>'minDepositUsd')::numeric, 10) into v_min
  from public.xena_settings where key = 'limits';
  if p_amount_usd < v_min then
    return jsonb_build_object('ok', false, 'error', 'Minimum crypto deposit is $' || v_min || '.');
  end if;

  select (secret->>'api_key') into v_api_key from public.payment_secrets where provider = 'nowpayments';
  if v_api_key is null then return jsonb_build_object('ok', false, 'error', 'Payment provider not configured.'); end if;

  v_res := extensions.http_post(
    'https://api.nowpayments.io/v1/invoice',
    jsonb_build_object(
      'price_amount', p_amount_usd,
      'price_currency', 'usd',
      'pay_currency', v_pay_currency,
      'order_id', 'xena-' || u || '-' || extract(epoch from now())::bigint,
      'order_description', 'XENA deposit via ' || upper(p_coin),
      'ipn_callback_url', 'https://investment-1234.vercel.app/api/crypto/ipn',
      'success_url', 'https://investment-1234.vercel.app/wallet',
      'cancel_url', 'https://investment-1234.vercel.app/wallet'
    )::text,
    'application/json',
    'x-api-key: ' || v_api_key
  );
  v_inv := (v_res.content)::jsonb;
  if (v_inv->>'id') is null then
    return jsonb_build_object('ok', false, 'error', coalesce(v_inv->>'message', 'NOWPayments rejected the invoice.'));
  end if;
  v_ref := coalesce(v_inv->>'payment_id', v_inv->>'id');
  perform public.record_pending_payment(v_ref, 'nowpayments', p_amount_usd, 'USD', v_email,
    jsonb_build_object('coin', lower(p_coin), 'method', 'crypto-' || lower(p_coin)));

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_ref,
    'pay_address', v_inv->>'pay_address',
    'pay_amount', coalesce(v_inv->>'pay_amount', p_amount_usd::text),
    'pay_currency', coalesce(v_inv->>'pay_currency', v_pay_currency),
    'status', coalesce(v_inv->>'payment_status', 'waiting'),
    'invoice_url', v_inv->>'invoice_url'
  );
end $$;

-- ── NOWPayments: poll payment status, credit if confirmed/finished ──
create or replace function public.client_check_crypto_deposit(p_payment_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_pay record;
  v_api_key text;
  v_res extensions.http_response;
  v_st text;
  v_price numeric;
  v_xena numeric;
begin
  perform set_config('http.timeout_msec', '20000', true);
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  if p_payment_id is null or p_payment_id = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing payment id.');
  end if;
  select * into v_pay from public.payments
  where provider = 'nowpayments' and reference = p_payment_id limit 1;
  if v_pay.id is null then return jsonb_build_object('ok', false, 'error', 'Payment not found.'); end if;
  if v_pay.user_id <> u then return jsonb_build_object('ok', false, 'error', 'Unauthorized.'); end if;
  if v_pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'status', 'confirmed', 'duplicate', true, 'xena', v_pay.xena);
  end if;

  select (secret->>'api_key') into v_api_key from public.payment_secrets where provider = 'nowpayments';
  if v_api_key is null then return jsonb_build_object('ok', false, 'error', 'Payment provider not configured.'); end if;

  v_res := extensions.http_get(
    'https://api.nowpayments.io/v1/payment/' || p_payment_id,
    'x-api-key: ' || v_api_key
  );
  v_st := coalesce((v_res.content)::jsonb->>'payment_status', 'waiting');
  if v_st not in ('confirmed', 'finished') then
    return jsonb_build_object('ok', true, 'status', v_st);
  end if;

  select coalesce((value->>'price')::numeric, 2.85) into v_price
  from public.xena_settings where key = 'price';
  v_xena := round((v_pay.amount / v_price) * 10000) / 10000;
  return public.credit_payment(
    v_pay.reference, 'nowpayments', v_pay.amount, 'USD', v_xena, v_pay.email,
    jsonb_build_object('coin', v_pay.meta->>'coin', 'method', v_pay.meta->>'method')
  );
end $$;

grant execute on function public.client_create_flutterwave_deposit(numeric) to authenticated;
grant execute on function public.client_verify_flutterwave_deposit(text) to authenticated;
grant execute on function public.client_create_crypto_invoice(text, numeric) to authenticated;
grant execute on function public.client_check_crypto_deposit(text) to authenticated;

-- 7) CORRECT XENA PRICE to the real market value:
--    $1 = N1300, and 3 XENA = N1  =>  1 XENA = N0.3333 = $0.0002564
insert into public.xena_settings(key, value) values
  ('price', jsonb_build_object('price', 0.0002564)),
  ('xena_ngn_rate', jsonb_build_object('ngnRate', 0.3333))
on conflict (key) do update set value = excluded.value;
-- Re-price every P2P listing so no stale ad price survives.
update public.p2p_offers set price_per_xena = 0.0002564;
-- Push the new price + NGN rate into every profile's balances blob so
-- wallets, holdings, charts and deposit/withdraw conversions match instantly.
update public.profiles
  set balances = jsonb_set(
        jsonb_set(balances, '{currentPrice}', to_jsonb(0.0002564)),
        '{xenaNgnRate}', to_jsonb(0.3333)),
      updated_at = now()
  where balances is not null;

-- Done. After running this script:
--   - Payments work without Vercel serverless (RPCs call Flutterwave/NOWPayments via the Postgres http extension)
--   - Promo code redemption is server-validated (RPC redeem_promo_code)
--   - Client can no longer write balances/transactions/redeemed codes via save_account_profile
--   - Admin login (admin12345@gmail.com / admin12345) should work via Supabase auth
--   - Showcase login (alex.morgan@xena.fi / xena-user-demo) should work via Supabase auth
