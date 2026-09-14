--
-- XENA Exchange — Supabase migration (run once in the SQL editor)
-- Postgres 15+, Supabase default schema `public`.
-- Covers: extensions, tables, RLS, Realtime, auth trigger, and all RPCs.
--

create extension if not exists "pgcrypto";

--
-- TABLES
--

-- Authenticated user profiles (one row per auth.users). Balances / transactions /
-- notifications are stored as JSONB using the exact camelCase shapes the React
-- client already uses, so the app swap stays 1:1.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  country text default 'Nigeria',
  phone text default '',
  dob text default '',
  referrer text default '',
  xena_id text,
  xena_code text,
  kyc_tier text default 'Tier 1 (Pending)',
  status text default 'Active',
  role text not null default 'user',
  two_factor_enabled boolean default false,
  pin_set boolean default false,
  verified_accounts_count integer default 0,
  balances jsonb not null default '{"totalXena":0,"totalBalance":0,"usdRate":1,"change24hAmount":0,"change24hPercent":0,"availableXena":0,"investedXena":0,"averageBuyPrice":0,"currentPrice":2.85,"stakedXena":0,"lockedInOrders":0,"nairaBalance":0,"xenaNgnRate":1500}'::jsonb,
  transactions jsonb not null default '[]'::jsonb,
  notifications jsonb not null default '[]'::jsonb,
  redeemed_bonus_codes jsonb not null default '[]'::jsonb,
  bank_details jsonb not null default '[]'::jsonb,
  wallet_addresses jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists bank_details jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists wallet_addresses jsonb not null default '[]'::jsonb;

-- Normalized per-vault investments with live progress, admin-cancel/restart support.
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  user_name text default '',
  plan_name text not null,
  category text default 'Flexible',
  invested_xena numeric default 0,
  apy numeric default 0,
  earned_xena numeric default 0,
  total_days integer default 0,
  days_remaining integer default 0,
  progress_percent numeric default 0,
  started_at timestamptz default now(),
  ended_at timestamptz,
  restarted_at timestamptz,
  canceled_at timestamptz,
  status text default 'active',
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists investments_user_idx on public.investments(user_id);
create index if not exists investments_status_idx on public.investments(status);

-- Admin-editable vault catalog (the 6 seeded plans, extendable).
create table if not exists public.vault_catalog (
  id text primary key,
  name text not null,
  category text default 'Flexible',
  apy numeric default 0,
  duration text default 'Flexible',
  days integer default 0,
  min_deposit numeric default 0,
  badge text default '',
  risk text default 'Low Risk',
  description text default '',
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- P2P ads. New ads are `pending` and only become visible after admin approval.
-- `sort_order` drives marketplace position (lower = higher); admin can move
-- any listing to the top or bottom.
create table if not exists public.p2p_offers (
  id text primary key,
  merchant_name text not null,
  merchant_tier text default 'Verified Trader',
  completion_rate numeric default 100,
  completed_orders integer default 0,
  orders_count integer default 0,
  type text,
  price_per_xena numeric default 2.85,
  currency text default 'USD',
  min_limit numeric default 50,
  max_limit numeric default 2500,
  available_xena numeric default 1000,
  payment_methods jsonb default '[]'::jsonb,
  payment_method text default 'Bank Transfer',
  response_time_minutes integer default 2,
  is_online boolean default true,
  status text default 'pending',
  listed_by text default '',
  listed_email text default '',
  listed_at bigint,
  sort_order integer default 1000,
  created_at timestamptz default now()
);
create index if not exists p2p_offers_status_idx on public.p2p_offers(status);

create table if not exists public.p2p_trades (
  id text primary key,
  offer_id text,
  merchant_name text default '',
  type text,
  method text,
  fiat_amount numeric default 0,
  currency text default 'USD',
  xena_amount numeric default 0,
  price_per_xena numeric default 2.85,
  buyer_email text,
  status text default 'awaiting_validation',
  reference text,
  time text,
  submitted_at bigint,
  created_at timestamptz default now()
);

create table if not exists public.support_conversations (
  id text primary key,
  user_id uuid,
  email text not null,
  user_name text default '',
  status text default 'open',
  created_at bigint,
  updated_at bigint,
  messages jsonb default '[]'::jsonb
);
create index if not exists support_conv_user_idx on public.support_conversations(user_id);

create table if not exists public.announcements (
  id text primary key,
  title text not null,
  date text,
  tag text default 'News',
  tag_color text default 'bg-emerald-50 text-[#16A34A] border-emerald-100',
  summary text,
  action_text text,
  action_id text,
  published_by text default 'admin12345@gmail.com',
  published boolean default true,
  created_at timestamptz default now()
);

-- Key/value global settings (price, feature flags, ₦ minimums, escrow contact).
create table if not exists public.xena_settings (
  key text primary key,
  value jsonb not null
);

-- Admin dashboard lists (users seed rows, txs, merchants, disputes, tickets,
-- promos, audit, deposits, referrals, bonusLog) persisted as one blob.
create table if not exists public.admin_state (
  id integer primary key check (id = 1),
  blob jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Deposit payment ledger (Paystack / NOWPayments). Idempotency via UNIQUE reference.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  provider text,
  reference text unique,
  amount numeric default 0,
  currency text default 'USD',
  xena numeric default 0,
  status text default 'pending',
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  confirmed_at timestamptz
);
create index if not exists payments_user_idx on public.payments(user_id);

-- Manual withdrawal requests — user submits, admin approves/rejects only.
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  user_name text default '',
  method text,
  amount_xena numeric default 0,
  amount_ngn numeric default 0,
  fee numeric default 0,
  bank text,
  account_number text,
  account_name text,
  address text,
  reference text,
  status text default 'pending',
  admin_note text,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz default now()
);
create index if not exists withdrawal_user_idx on public.withdrawal_requests(user_id);
create index if not exists withdrawal_status_idx on public.withdrawal_requests(status);

--
-- updated_at TRIGGER
--

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_investments on public.investments;
create trigger set_updated_at_investments before update on public.investments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments before update on public.payments
for each row execute function public.set_updated_at();

--
-- NEW USER TRIGGER — every registration persists to Supabase Auth + profiles.
--

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_prefix text := 'xena-' || lpad(floor(random() * 90000000 + 10000000)::int::text, 8, '0');
begin
  v_name := coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(lower(new.email), '@', 1));
  insert into public.profiles (id, email, name, xena_id, xena_code, role)
  values (
    new.id,
    lower(new.email),
    v_name,
    'XN-' || lpad((floor(random() * 8999999 + 1000000)::int)::text, 7, '0'),
    v_prefix,
    'user'
  )
  on conflict (id) do nothing;
  insert into public.support_conversations (id, user_id, email, user_name, status, created_at, updated_at, messages)
  values ('cs-' || substr(gen_random_uuid()::text, 1, 12), new.id, lower(new.email), v_name, 'open',
    (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint, '[]'::jsonb)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

--
-- HELPERS
--

-- Returns true when the signed-in identity is THE admin account.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(email) from public.profiles where id = auth.uid();
$$;

--
-- ROW LEVEL SECURITY
--

alter table public.profiles enable row level security;
alter table public.investments enable row level security;
alter table public.vault_catalog enable row level security;
alter table public.p2p_offers enable row level security;
alter table public.p2p_trades enable row level security;
alter table public.support_conversations enable row level security;
alter table public.announcements enable row level security;
alter table public.xena_settings enable row level security;
alter table public.admin_state enable row level security;
alter table public.payments enable row level security;
alter table public.withdrawal_requests enable row level security;

-- profiles: own read/update; admins read all. Insert only via trigger/service role.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

-- investments: owner read, admin read-all. Mutations only via RPCs.
drop policy if exists investments_select_own on public.investments;
create policy investments_select_own on public.investments for select using (auth.uid() = user_id);
drop policy if exists investments_select_admin on public.investments;
create policy investments_select_admin on public.investments for select using (public.is_admin());

-- vault_catalog: public read; admin writes via RPCs.
drop policy if exists vault_catalog_select_public on public.vault_catalog;
create policy vault_catalog_select_public on public.vault_catalog for select using (true);

-- p2p_offers: public sees only approved; admins see everything.
drop policy if exists p2p_offers_select_public on public.p2p_offers;
create policy p2p_offers_select_public on public.p2p_offers for select using (status = 'approved');
drop policy if exists p2p_offers_select_admin on public.p2p_offers;
create policy p2p_offers_select_admin on public.p2p_offers for select using (public.is_admin());

-- p2p_trades: buyer reads own; admin reads all.
drop policy if exists p2p_trades_select_own on public.p2p_trades;
create policy p2p_trades_select_own on public.p2p_trades for select using (lower(buyer_email) = public.current_email());
drop policy if exists p2p_trades_select_admin on public.p2p_trades;
create policy p2p_trades_select_admin on public.p2p_trades for select using (public.is_admin());

-- support: owner read; admin read all.
drop policy if exists support_select_own on public.support_conversations;
create policy support_select_own on public.support_conversations for select using (user_id = auth.uid());
drop policy if exists support_select_admin on public.support_conversations;
create policy support_select_admin on public.support_conversations for select using (public.is_admin());

-- announcements / xena_settings: public read.
drop policy if exists announcements_select_public on public.announcements;
create policy announcements_select_public on public.announcements for select using (published = true);
drop policy if exists xena_settings_select_public on public.xena_settings;
create policy xena_settings_select_public on public.xena_settings for select using (true);

-- admin_state: admin only.
drop policy if exists admin_state_select_admin on public.admin_state;
create policy admin_state_select_admin on public.admin_state for select using (public.is_admin());

-- payments / withdrawals: owner read own; admin read all.
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select using (user_id = auth.uid());
drop policy if exists payments_select_admin on public.payments;
create policy payments_select_admin on public.payments for select using (public.is_admin());
drop policy if exists withdrawal_select_own on public.withdrawal_requests;
create policy withdrawal_select_own on public.withdrawal_requests for select using (user_id = auth.uid());
drop policy if exists withdrawal_select_admin on public.withdrawal_requests;
create policy withdrawal_select_admin on public.withdrawal_requests for select using (public.is_admin());

--
-- REALTIME — live push for balances, investments, admin actions, price, chat…
--

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.investments;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.withdrawal_requests;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.support_conversations;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.p2p_offers;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.p2p_trades;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.xena_settings;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.vault_catalog;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.admin_state;
exception when duplicate_object then null; end $$;

--
-- PUBLIC STATE (price, limits, flags, announcements, catalog, approved offers)
--

create or replace function public.get_public_state()
returns jsonb language plpgsql stable as $$
declare
  v_price numeric;
  v_rate numeric;
  v_limits jsonb;
  v_flags jsonb;
  v_ann jsonb;
  v_cat jsonb;
  v_offers jsonb;
  v_escrow jsonb;
begin
  select (value->>'price')::numeric into v_price from public.xena_settings where key = 'price';
  if v_price is null then v_price := 2.85; end if;
  select (value->>'ngnRate')::numeric into v_rate from public.xena_settings where key = 'xena_ngn_rate';
  if v_rate is null then
    select (value->>'xenaNgnRate')::numeric into v_rate from public.xena_settings where key = 'limits';
  end if;
  if v_rate is null then v_rate := 1500; end if;
  select value into v_limits from public.xena_settings where key = 'limits';
  if v_limits is null then v_limits := '{"min_deposit_ngn":3000,"min_withdrawal_ngn":3000}'::jsonb; end if;
  select value into v_flags from public.xena_settings where key = 'flags';
  if v_flags is null then v_flags := '{"maintenanceMode":false,"p2pZeroFee":true,"withdrawApproval":true}'::jsonb; end if;
  select value into v_escrow from public.xena_settings where key = 'escrow';
  if v_escrow is null then v_escrow := '{}'::jsonb; end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
    into v_ann from announcements a where a.published = true;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order asc, c.created_at asc), '[]'::jsonb)
    into v_cat from vault_catalog c where c.active = true;
  select coalesce(jsonb_agg(o order by coalesce((o->>'sort_order')::numeric, 9999) asc, o->>'listed_at' desc nulls last), '[]'::jsonb)
    into v_offers
    from (select to_jsonb(x) as o from (select * from p2p_offers where status = 'approved') x) q;

  return jsonb_build_object(
    'xenaPrice', v_price,
    'xenaNgnRate', v_rate,
    'limits', v_limits,
    'settings', v_flags,
    'escrow', v_escrow,
    'announcements', v_ann,
    'vaultCatalog', v_cat,
    'p2pOffers', v_offers
  );
end $$;

--
-- OWN SESSION STATE
--

create or replace function public.get_my_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if auth.uid() is null then return null; end if;
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'investments', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from investments i where i.user_id = p.id), '[]'::jsonb),
    'p2pTrades', coalesce((select jsonb_agg(to_jsonb(t) order by t.submitted_at desc nulls last) from p2p_trades t where lower(t.buyer_email) = lower(p.email)), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pm) order by pm.created_at desc) from payments pm where pm.user_id = p.id), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from withdrawal_requests w where w.user_id = p.id), '[]'::jsonb)
  )
  into v from profiles p where p.id = auth.uid();
  return v;
end $$;

--
-- ADMIN STATE
--

create or replace function public.admin_get_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'blob', coalesce((select a.blob from admin_state a where a.id = 1), '{}'::jsonb),
    'profiles', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from profiles p), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from investments i), '[]'::jsonb),
    'p2pOffers', coalesce((select jsonb_agg(o order by coalesce((o->>'sort_order')::numeric, 9999) asc, o->>'listed_at' desc nulls last)
        from (select to_jsonb(x) as o from (select * from p2p_offers) x) x2), '[]'::jsonb),
    'p2pTrades', coalesce((select jsonb_agg(to_jsonb(t) order by t.submitted_at desc nulls last) from p2p_trades t), '[]'::jsonb),
    'withdrawals', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from withdrawal_requests w), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(pm) order by pm.created_at desc) from payments pm), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(to_jsonb(c) order by c.updated_at desc nulls last) from support_conversations c), '[]'::jsonb),
    'settings', coalesce((select value from xena_settings where key = 'flags'), '{}'::jsonb),
    'limits', coalesce((select value from xena_settings where key = 'limits'), '{}'::jsonb),
    'price', coalesce((select (value->>'price')::numeric from xena_settings where key = 'price'), 2.85),
    'xenaNgnRate', coalesce((select (value->>'ngnRate')::numeric from xena_settings where key = 'xena_ngn_rate'),
      (select (value->>'xenaNgnRate')::numeric from xena_settings where key = 'limits'), 1500)
  ) into v;
  return v;
end $$;

--
-- PROFILE SAVE (write-through on every user change)
--

create or replace function public.save_account_profile(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  -- Security: user-writable fields are strictly whitelisted. Balances,
  -- transactions, redeemed bonus codes, KYC tier and verified-account counts
  -- are SERVER-OWNED and can only change via deposits, promo redemption,
  -- admin adjustments or admin actions. Client-supplied values are ignored.
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

--
-- ADMIN: PRICE / SETTINGS / LIMITS / STATE
--

-- Drop EVERY overload of the function so the new price+ngn-rate signature
-- replaces it instead of overloading (prevents 42725 function not unique).
-- Uses a catalog loop because `drop function foo(*)` is not accepted by all SQL editors.
do $$
declare r record;
begin
  for r in (
    select n.nspname, p.proname, p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_set_price'
  ) loop
    execute format('drop function %I.%I(%s)', r.nspname, r.proname, pg_get_function_identity_arguments(r.oid));
  end loop;
end $$;

create or replace function public.admin_set_price(p_price numeric, p_ngn_rate numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p numeric := round(p_price, 4); r numeric := round(coalesce(p_ngn_rate, 1500), 2);
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if p is null or p <= 0 then return jsonb_build_object('ok', false, 'error', 'Enter a valid price greater than 0.'); end if;
  if r <= 0 then return jsonb_build_object('ok', false, 'error', 'Enter a valid NGN rate greater than 0.'); end if;
  insert into public.xena_settings(key, value) values ('price', jsonb_build_object('price', p))
    on conflict (key) do update set value = excluded.value;
  insert into public.xena_settings(key, value) values ('xena_ngn_rate', jsonb_build_object('ngnRate', r))
    on conflict (key) do update set value = excluded.value;
  -- One price rule for the whole site: re-price every P2P listing so no stale
  -- ad price survives after the admin changes the rate.
  update public.p2p_offers set price_per_xena = p;
  -- Push the new price + ngn rate into every profile's balances blob so
  -- wallets, holdings and charts all show the same number instantly.
  update public.profiles
    set balances = jsonb_set(jsonb_set(balances, '{currentPrice}', to_jsonb(p)), '{xenaNgnRate}', to_jsonb(r)),
        updated_at = now()
    where balances is not null;
  return jsonb_build_object('ok', true, 'price', p, 'xenaNgnRate', r);
end $$;

create or replace function public.admin_update_limits(p_min_deposit numeric, p_min_withdrawal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare md numeric := round(p_min_deposit, 2); mw numeric := round(p_min_withdrawal, 2);
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if md <= 0 or mw <= 0 then return jsonb_build_object('ok', false, 'error', 'Minimums must be greater than 0.'); end if;
  insert into public.xena_settings(key, value) values ('limits', jsonb_build_object('min_deposit_ngn', md, 'min_withdrawal_ngn', mw))
    on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_update_settings(p_flags jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  insert into public.xena_settings(key, value) values ('flags', p_flags)
    on conflict (key) do update set value = excluded.value;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_state(blob jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if blob is null or jsonb_typeof(blob) <> 'object' then return jsonb_build_object('ok', false, 'error', 'Invalid payload'); end if;
  insert into public.admin_state(id, blob, updated_at) values (1, blob, now())
    on conflict (id) do update set blob = excluded.blob, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

--
-- ADMIN: ANNOUNCEMENTS (keep announcements table in sync with the admin portal)
--

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

--
-- ADMIN: PROMO CODES (keep xena_settings promos in sync with the admin portal)
--

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

--
-- ADMIN: ADJUST USER BALANCE (credit/debit + journal)
--

create or replace function public.admin_adjust_balance(p_target_email text, p_amount numeric, p_memo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx jsonb;
  notif jsonb;
  out_bal numeric;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if p_target_email is null or p_amount is null or p_amount = 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing target email or amount.');
  end if;
  tx := jsonb_build_object(
    'id', 'tx-admin-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(gen_random_uuid()::text, 1, 4),
    'title', case when p_amount >= 0 then 'Admin Credit — ' || coalesce(p_memo, 'Balance adjustment') else 'Admin Debit — ' || coalesce(p_memo, 'Balance adjustment') end,
    'type', case when p_amount >= 0 then 'deposit' else 'withdrawal' end,
    'amount', abs(p_amount),
    'unit', 'XENA',
    'status', 'Completed',
    'timestamp', 'Just now',
    'counterparty', 'XENA Admin',
    'paymentMethod', 'Admin Adjustment',
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-admin-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    'title', case when p_amount >= 0 then 'Balance Credited by Admin' else 'Balance Debited by Admin' end,
    'message', case when p_amount >= 0 then 'Admin added ' || abs(p_amount) || ' XENA to your balance.' || coalesce(' ' || p_memo, '') else 'Admin removed ' || abs(p_amount) || ' XENA from your balance.' || coalesce(' ' || p_memo, '') end,
    'timestamp', 'Just now',
    'read', false,
    'type', 'transaction'
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', (greatest(0, (balances->>'availableXena')::numeric + p_amount))::numeric::text::jsonb),
      '{totalBalance}',
      (greatest(0, (balances->>'totalBalance')::numeric + p_amount))::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where lower(email) = lower(p_target_email)
  returning (balances->>'availableXena')::numeric into out_bal;
  if not found then return jsonb_build_object('ok', false, 'error', 'No account found with that email.'); end if;
  return jsonb_build_object('ok', true, 'newBalance', out_bal);
end $$;

--
-- ADMIN: HARD DELETE PROFILE DATA (the auth.user itself is removed by the
-- /api/delete-user Vercel function using the service role key)
--

create or replace function public.admin_delete_profile(p_target_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select id into u from public.profiles where lower(email) = lower(p_target_email);
  if u is null then return jsonb_build_object('ok', false, 'error', 'No account found with that email.'); end if;
  delete from public.p2p_offers where lower(listed_email) = lower(p_target_email);
  delete from public.p2p_trades where lower(buyer_email) = lower(p_target_email);
  delete from public.support_conversations where lower(email) = lower(p_target_email);
  delete from public.payments where lower(email) = lower(p_target_email);
  delete from public.withdrawal_requests where lower(email) = lower(p_target_email);
  delete from public.profiles where id = u;
  return jsonb_build_object('ok', true);
end $$;

--
-- P2P LISTINGS (user posts -> admin approves before it is listed publicly)
--

create or replace function public.submit_p2p_offer(offer jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_email text;
  v_name text;
  new_id text;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'You must be signed in to post an ad.'); end if;
  select p.email, p.name into v_email, v_name from public.profiles p where p.id = u;
  new_id := coalesce(offer->>'id', 'p2p-ad-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text);
  insert into public.p2p_offers (
    id, merchant_name, merchant_tier, completion_rate, completed_orders, orders_count,
    type, price_per_xena, currency, min_limit, max_limit, available_xena,
    payment_methods, payment_method, response_time_minutes, is_online, status,
    listed_by, listed_email, listed_at, sort_order
  ) values (
    new_id,
    coalesce(offer->>'merchantName', v_name, v_email),
    coalesce(offer->>'merchantTier', 'Verified Trader'),
    coalesce((offer->>'completionRate')::numeric, 100),
    coalesce((offer->>'completedOrders')::int, 0),
    coalesce((offer->>'ordersCount')::int, 0),
    coalesce(offer->>'type', 'SELL'),
    coalesce((offer->>'pricePerXena')::numeric, (select (value->>'price')::numeric from public.xena_settings where key = 'price'), 2.85),
    coalesce(offer->>'currency', 'USD'),
    coalesce((offer->>'minLimit')::numeric, 50),
    coalesce((offer->>'maxLimit')::numeric, 2500),
    coalesce((offer->>'availableXena')::numeric, 1000),
    coalesce(offer->'paymentMethods', '["Bank Transfer"]'::jsonb),
    coalesce(offer->>'paymentMethod', 'Bank Transfer'),
    coalesce((offer->>'responseTimeMinutes')::int, 2),
    true,
    'pending',
    v_name,
    v_email,
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    1000
  );
  return jsonb_build_object('ok', true, 'offer', (select to_jsonb(o) from public.p2p_offers o where o.id = new_id));
end $$;

create or replace function public.approve_p2p_offer(p_offer_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text; v_name text;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  update public.p2p_offers set status = 'approved', sort_order = coalesce((select max(sort_order) from public.p2p_offers), 0) + 1
  where id = p_offer_id and status <> 'approved'
  returning listed_email, listed_by into v_email, v_name;
  if v_email is null then
    if exists (select 1 from public.p2p_offers where id = p_offer_id) then
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'Offer not found.');
  end if;
  if v_email is not null and v_email <> public.current_email() then
    update public.profiles set
      notifications = jsonb_build_object(
        'id', 'notif-p2p-app-' || substr(gen_random_uuid()::text, 1, 8),
        'title', 'P2P Ad Approved',
        'message', 'Your P2P ad has been approved and is now live in the marketplace.',
        'timestamp', 'Just now',
        'read', false,
        'type', 'system'
      ) || notifications
    where lower(email) = lower(v_email);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.reject_p2p_offer(p_offer_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select listed_email into v_email from public.p2p_offers where id = p_offer_id;
  if v_email is null then return jsonb_build_object('ok', false, 'error', 'Offer not found.'); end if;
  update public.p2p_offers set status = 'rejected' where id = p_offer_id;
  if v_email <> public.current_email() then
    update public.profiles set
      notifications = jsonb_build_object(
        'id', 'notif-p2p-rej-' || substr(gen_random_uuid()::text, 1, 8),
        'title', 'P2P Ad Rejected',
        'message', 'Your P2P ad was rejected by an administrator.',
        'timestamp', 'Just now',
        'read', false,
        'type', 'system'
      ) || notifications
    where lower(email) = lower(v_email);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin moves a listing up (towards the top) or down (towards the bottom).
create or replace function public.admin_p2p_move(p_offer_id text, p_direction text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cur_offer public.p2p_offers%rowtype;
  peer_id text;
  peer_order int;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into cur_offer from public.p2p_offers where id = p_offer_id;
  if cur_offer is null then return jsonb_build_object('ok', false, 'error', 'Offer not found.'); end if;
  if p_direction = 'up' then
    select id into peer_id from public.p2p_offers
      where status = 'approved' and (sort_order < cur_offer.sort_order or (sort_order = cur_offer.sort_order and id < p_offer_id))
      order by sort_order desc, id desc
      limit 1;
  else
    select id into peer_id from public.p2p_offers
      where status = 'approved' and (sort_order > cur_offer.sort_order or (sort_order = cur_offer.sort_order and id > p_offer_id))
      order by sort_order asc, id asc
      limit 1;
  end if;
  if peer_id is null then return jsonb_build_object('ok', true, 'moved', false); end if;
  select sort_order into peer_order from public.p2p_offers where id = peer_id;
  update public.p2p_offers set sort_order = peer_order where id = p_offer_id;
  update public.p2p_offers set sort_order = cur_offer.sort_order where id = peer_id;
  return jsonb_build_object('ok', true, 'moved', true);
end $$;

--
-- P2P PAYMENTS (admin approval releases XENA to the buyer)
--

create or replace function public.submit_p2p_payment(trade jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_email text;
  new_id text;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'You must be signed in to submit payment.'); end if;
  select email into v_email from public.profiles where id = u;
  new_id := coalesce(trade->>'id', 'p2p-tx-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text);
  insert into public.p2p_trades (
    id, offer_id, merchant_name, type, method, fiat_amount, currency, xena_amount,
    price_per_xena, buyer_email, status, reference, time, submitted_at
  ) values (
    new_id,
    trade->>'offerId',
    coalesce(trade->>'merchantName', ''),
    coalesce(trade->>'type', 'BUY'),
    coalesce(trade->>'method', ''),
    coalesce((trade->>'fiatAmount')::numeric, 0),
    coalesce(trade->>'currency', 'USD'),
    coalesce((trade->>'xenaAmount')::numeric, 0),
    coalesce((trade->>'pricePerXena')::numeric, 2.85),
    v_email,
    'awaiting_validation',
    coalesce(trade->>'reference', 'XN-' || (floor(10000 + random() * 90000))::int::text || '-P2P'),
    'Just now',
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );
  return jsonb_build_object('ok', true, 'trade', (select to_jsonb(t) from public.p2p_trades t where t.id = new_id));
end $$;

create or replace function public.approve_p2p_payment(p_trade_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.p2p_trades%rowtype;
  v_xena numeric;
  tx jsonb;
  notif jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into t from public.p2p_trades where id = p_trade_id;
  if t is null then return jsonb_build_object('ok', false, 'error', 'Trade not found.'); end if;
  if t.status = 'approved' then return jsonb_build_object('ok', true, 'credited', true); end if;
  update public.p2p_trades set status = 'approved' where id = p_trade_id;
  v_xena := t.xena_amount;
  tx := jsonb_build_object(
    'id', 'tx-p2p-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'P2P Purchase (' || coalesce(t.method, '') || ')',
    'type', 'p2p_buy',
    'amount', v_xena,
    'unit', 'XENA',
    'status', 'Completed',
    'timestamp', 'Just now',
    'counterparty', t.merchant_name,
    'paymentMethod', t.method,
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-p2p-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'P2P Payment Approved',
    'message', 'Admin validated your ' || coalesce(t.method, '') || ' payment. ' || v_xena || ' XENA has been released to your balance.',
    'timestamp', 'Just now',
    'read', false,
    'type', 'transaction'
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + v_xena)::numeric::text::jsonb),
      '{totalBalance}',
      ((balances->>'totalBalance')::numeric + v_xena)::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where lower(email) = lower(t.buyer_email);
  return jsonb_build_object('ok', true, 'credited', true);
end $$;

create or replace function public.reject_p2p_payment(p_trade_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  update public.p2p_trades set status = 'rejected' where id = p_trade_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Trade not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

--
-- SUPPORT CONVERSATIONS (user messages + admin replies, both persisted)
--

create or replace function public.get_support_conversations()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  if public.is_admin() then
    select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc nulls last), '[]'::jsonb) into v
      from public.support_conversations c;
    return v;
  end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc nulls last), '[]'::jsonb) into v
    from public.support_conversations c where c.user_id = auth.uid();
  if v is null or jsonb_array_length(v) = 0 then
    v := jsonb_build_array(
      (select to_jsonb(c) from public.support_conversations c where c.user_id = auth.uid())
    );
    -- ensure a conversation row exists for the user (created lazily if missing)
    insert into public.support_conversations (id, user_id, email, user_name, status, created_at, updated_at, messages)
    select 'cs-' || substr(gen_random_uuid()::text, 1, 12), p.id, p.email, p.name, 'open',
      (extract(epoch from now()) * 1000)::bigint, (extract(epoch from now()) * 1000)::bigint, '[]'::jsonb
    from public.profiles p where p.id = auth.uid()
    on conflict (id) do nothing;
  end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.updated_at desc nulls last), '[]'::jsonb) into v
    from public.support_conversations c where c.user_id = auth.uid();
  return v;
end $$;

create or replace function public.send_support_message(p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  v_conv_id text;
  v_email text;
  v_name text;
  v_created bigint;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  msg jsonb;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  if coalesce(trim(p_text), '') = '' then return jsonb_build_object('ok', false, 'error', 'Message cannot be empty.'); end if;
  select email, name into v_email, v_name from public.profiles where id = u;
  select id, created_at into v_conv_id, v_created from public.support_conversations where user_id = u;
  if v_conv_id is null then
    v_conv_id := 'cs-' || substr(gen_random_uuid()::text, 1, 12);
    insert into public.support_conversations (id, user_id, email, user_name, status, created_at, updated_at, messages)
    values (v_conv_id, u, v_email, v_name, 'open', v_now, v_now, '[]'::jsonb);
  end if;
  msg := jsonb_build_object('from', 'user', 'text', p_text, 'time', to_char(now(), 'Mon DD, YYYY HH12:MI:SS AM'));
  update public.support_conversations set messages = messages || msg, status = 'open', updated_at = v_now where id = v_conv_id;
  return jsonb_build_object('ok', true, 'conversation', (select to_jsonb(c) from public.support_conversations c where c.id = v_conv_id));
end $$;

create or replace function public.reply_support_conversation(p_email text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conv_id text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  msg jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  if coalesce(trim(p_text), '') = '' then return jsonb_build_object('ok', false, 'error', 'Message cannot be empty.'); end if;
  select id into v_conv_id from public.support_conversations where lower(email) = lower(p_email);
  if v_conv_id is null then
    v_conv_id := 'cs-' || substr(gen_random_uuid()::text, 1, 12);
    insert into public.support_conversations (id, user_id, email, user_name, status, created_at, updated_at, messages)
    select v_conv_id, coalesce(p.id, null), p.email, p.name, 'open', v_now, v_now, '[]'::jsonb
    from (select id, email, name from public.profiles where lower(email) = lower(p_email)) p
    on conflict (id) do nothing;
    if not exists (select 1 from public.support_conversations where id = v_conv_id) then
      insert into public.support_conversations (id, user_id, email, user_name, status, created_at, updated_at, messages)
      values (v_conv_id, null, lower(p_email), lower(p_email), 'open', v_now, v_now, '[]'::jsonb);
    end if;
  end if;
  msg := jsonb_build_object('from', 'agent', 'text', p_text, 'time', to_char(now(), 'Mon DD, YYYY HH12:MI:SS AM'));
  update public.support_conversations set messages = messages || msg, status = 'open', updated_at = v_now where id = v_conv_id;
  return jsonb_build_object('ok', true, 'conversation', (select to_jsonb(c) from public.support_conversations c where c.id = v_conv_id));
end $$;

create or replace function public.resolve_support_conversation(p_conversation_id text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  update public.support_conversations set status = case when p_status = 'resolved' then 'resolved' else 'open' end
  where id = p_conversation_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Conversation not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

--
-- WITHDRAWALS (user submits -> admin-only Approve/Reject)
--

create or replace function public.create_withdrawal_request(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  p public.profiles%rowtype;
  v_limits jsonb;
  v_min_ngn numeric;
  v_ngn_rate numeric;
  method_text text;
  amt_x numeric;
  amt_ngn numeric;
  v_min_x numeric;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select * into p from public.profiles where id = u;
  if p is null then return jsonb_build_object('ok', false, 'error', 'Account not found.'); end if;

  select value into v_limits from public.xena_settings where key = 'limits';
  if v_limits is null then v_limits := '{"min_deposit_ngn":3000,"min_withdrawal_ngn":3000}'::jsonb; end if;
  v_min_ngn := coalesce((v_limits->>'min_withdrawal_ngn')::numeric, 3000);
  v_ngn_rate := coalesce(
    (select (value->>'ngnRate')::numeric from public.xena_settings where key = 'xena_ngn_rate'),
    coalesce((p.balances->>'xenaNgnRate')::numeric, 1500)
  );

method_text := coalesce(payload->>'method', 'ngn');
  amt_ngn := coalesce((payload->>'amount_ngn')::numeric, 0);
  amt_x := coalesce((payload->>'amount_xena')::numeric, 0);
  if method_text = 'ngn' then amt_x := amt_ngn / v_ngn_rate; else amt_ngn := amt_x * v_ngn_rate; end if;

  if amt_x <= 0 then return jsonb_build_object('ok', false, 'error', 'Enter a valid amount.'); end if;
  if amt_x < (v_min_ngn / v_ngn_rate) then
    return jsonb_build_object('ok', false, 'error', 'Withdrawal must be at least ₦' || v_min_ngn::text || ' (' || round(v_min_ngn / v_ngn_rate, 2)::text || ' XENA).');
  end if;
  if amt_x > (p.balances->>'availableXena')::numeric then
    return jsonb_build_object('ok', false, 'error', 'Insufficient available XENA for this withdrawal.');
  end if;

  insert into public.withdrawal_requests (
    user_id, email, user_name, method, amount_xena, amount_ngn, fee,
    bank, account_number, account_name, address, reference, status
  ) values (
    u, p.email, p.name, method_text,
    round(amt_x, 4), round(amt_ngn, 2), 0,
    payload->>'bank', payload->>'account_number', payload->>'account_name', payload->>'address',
    'WD-' || substr(gen_random_uuid()::text, 1, 10) || '-' || floor(10000 + random() * 90000)::int::text,
    'pending'
  );
  return jsonb_build_object('ok', true, 'request', (select to_jsonb(w) from public.withdrawal_requests w
    where w.email = p.email and w.reference = (select reference from public.withdrawal_requests where email = p.email order by created_at desc limit 1)));
end $$;

create or replace function public.admin_decide_withdrawal(p_request_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  w public.withdrawal_requests%rowtype;
  tx jsonb;
  notif jsonb;
  v_bal numeric;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into w from public.withdrawal_requests where id = p_request_id;
  if w is null then return jsonb_build_object('ok', false, 'error', 'Withdrawal request not found.'); end if;
  if w.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'This request was already decided.'); end if;

  if p_decision = 'approved' then
    select (balances->>'availableXena')::numeric into v_bal from public.profiles where id = w.user_id;
    if v_bal is null then return jsonb_build_object('ok', false, 'error', 'User account not found.'); end if;
    if v_bal < w.amount_xena then return jsonb_build_object('ok', false, 'error', 'Insufficient balance — user no longer has enough XENA.'); end if;
    tx := jsonb_build_object(
      'id', 'tx-wd-' || substr(gen_random_uuid()::text, 1, 8),
      'title', 'Withdrawal' || case when w.method in ('usdt','usdc','btc','sol','eth','xena') then ' (Crypto)' else ' (NGN Bank)' end,
      'type', 'withdrawal',
      'amount', w.amount_xena,
      'unit', 'XENA',
      'status', 'Completed'::text,
      'timestamp', 'Just now',
      'paymentMethod', case when w.method = 'ngn' then 'NGN Bank Transfer' else upper(w.method) || ' Network Transfer' end,
      'fee', w.fee
    );
    notif := jsonb_build_object(
      'id', 'notif-wd-' || substr(gen_random_uuid()::text, 1, 8),
      'title', 'Withdrawal Approved',
      'message', 'Your withdrawal of ' || w.amount_xena || ' XENA has been approved' || coalesce('. ' || p_note, '.'),
      'timestamp', 'Just now', 'read', false, 'type', 'transaction'
    );
    update public.profiles set
      balances = jsonb_set(
        jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric - w.amount_xena)::numeric::text::jsonb),
        '{totalBalance}',
        (greatest(0, (balances->>'totalBalance')::numeric - w.amount_xena))::numeric::text::jsonb
      ),
      transactions = jsonb_build_array(tx) || transactions,
      notifications = jsonb_build_array(notif) || notifications,
      updated_at = now()
    where id = w.user_id;
    update public.withdrawal_requests set status = 'approved', admin_note = p_note, decided_at = now(), decided_by = public.current_email()
      where id = p_request_id;
    return jsonb_build_object('ok', true, 'decision', 'approved');
  end if;

  notif := jsonb_build_object(
    'id', 'notif-wd-rej-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Withdrawal Rejected',
    'message', 'Your withdrawal of ' || w.amount_xena || ' XENA was rejected' || coalesce('. Reason: ' || p_note, '.'),
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );
  update public.profiles set notifications = jsonb_build_array(notif) || notifications where id = w.user_id;
  update public.withdrawal_requests set status = 'rejected', admin_note = p_note, decided_at = now(), decided_by = public.current_email()
    where id = p_request_id;
  return jsonb_build_object('ok', true, 'decision', 'rejected');
end $$;

--
-- INVESTMENTS (stake / claim / accrue / admin cancel · restart · payout)
--

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

create or replace function public.user_claim_yield(p_investment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  inv public.investments%rowtype;
  v_amount numeric;
  tx jsonb;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'Not authenticated'); end if;
  select * into inv from public.investments where id = p_investment_id and user_id = u;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'Investment not found.'); end if;
  v_amount := inv.earned_xena;
  if v_amount is null or v_amount <= 0 then return jsonb_build_object('ok', false, 'error', 'No yield to claim yet.'); end if;
  tx := jsonb_build_object(
    'id', 'tx-yield-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Yield Claimed — ' || inv.plan_name,
    'type', 'yield',
    'amount', v_amount,
    'unit', 'XENA',
    'timestamp', 'Just now',
    'status', 'Completed',
    'paymentMethod', 'Vault',
    'fee', 0
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + v_amount)::numeric::text::jsonb),
      '{totalBalance}',
      ((balances->>'totalBalance')::numeric + v_amount)::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    updated_at = now()
  where id = u;
  update public.investments set earned_xena = 0, updated_at = now() where id = p_investment_id;
  return jsonb_build_object('ok', true, 'amount', v_amount);
end $$;

-- Daily progress tick (run by /api/cron/accrue): decrement day counter, accrue
-- APY/365 yield, persist progress_percent, and mature finished vaults.
create or replace function public.accrue_investments()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int := 0; r int;
begin
  for r in select id from public.investments where status = 'active' and total_days > 0 loop
    update public.investments set
      days_remaining = greatest(0, days_remaining - 1),
      earned_xena = earned_xena + (invested_xena * apy / 36500.0),
      progress_percent = round((((total_days - greatest(days_remaining - 1, 0))::numeric) / total_days) * 100, 2),
      status = case when days_remaining - 1 <= 0 then 'matured' else 'active' end,
      ended_at = case when days_remaining - 1 <= 0 then now() else ended_at end,
      updated_at = now()
    where id = r;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'processed', n);
end $$;

create or replace function public.admin_restart_investment(p_investment_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.investments%rowtype; notif jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into inv from public.investments where id = p_investment_id;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'Investment not found.'); end if;
  if inv.status = 'active' then return jsonb_build_object('ok', false, 'error', 'Investment is already active.'); end if;
  update public.investments set
    status = 'active', days_remaining = total_days, earned_xena = 0, progress_percent = 0,
    started_at = now(), restarted_at = now(), canceled_at = null, ended_at = null,
    admin_note = p_note, updated_at = now()
  where id = p_investment_id;
  notif := jsonb_build_object(
    'id', 'notif-restart-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Investment Restarted',
    'message', 'Your ' || inv.plan_name || ' vault was restarted with a fresh ' || inv.total_days || '-day term by an administrator.',
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );
  update public.profiles set notifications = jsonb_build_array(notif) || notifications where id = inv.user_id;
  return jsonb_build_object('ok', true, 'investment', (select to_jsonb(i) from public.investments i where i.id = p_investment_id));
end $$;

create or replace function public.admin_cancel_investment(p_investment_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.investments%rowtype; tx jsonb; notif jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into inv from public.investments where id = p_investment_id;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'Investment not found.'); end if;
  if inv.status = 'canceled' then return jsonb_build_object('ok', false, 'error', 'Investment already canceled.'); end if;
  tx := jsonb_build_object(
    'id', 'tx-cxl-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Investment Cancelled (Principal Refund) — ' || inv.plan_name,
    'type', 'investment',
    'amount', inv.invested_xena,
    'unit', 'XENA',
    'timestamp', 'Just now',
    'status', 'Completed',
    'paymentMethod', 'Admin Cancellation',
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-cxl-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Investment Cancelled by Admin',
    'message', 'Your ' || inv.plan_name || ' vault was cancelled. Principal of ' || inv.invested_xena || ' XENA was returned to your balance. Accrued yield was forfeited.' || coalesce(' ' || p_note, '.'),
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + inv.invested_xena)::numeric::text::jsonb),
      '{investedXena}',
      (greatest(0, (balances->>'investedXena')::numeric - inv.invested_xena))::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where id = inv.user_id;
  update public.investments set status = 'canceled', earned_xena = 0, canceled_at = now(), ended_at = now(), admin_note = p_note, updated_at = now()
    where id = p_investment_id;
  return jsonb_build_object('ok', true, 'investment', (select to_jsonb(i) from public.investments i where i.id = p_investment_id));
end $$;

create or replace function public.admin_payout_investment(p_investment_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv public.investments%rowtype; v_total numeric; tx jsonb; notif jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  select * into inv from public.investments where id = p_investment_id;
  if inv is null then return jsonb_build_object('ok', false, 'error', 'Investment not found.'); end if;
  if inv.status in ('matured', 'canceled') then return jsonb_build_object('ok', false, 'error', 'Investment already ended.'); end if;
  v_total := inv.invested_xena + inv.earned_xena;
  tx := jsonb_build_object(
    'id', 'tx-po-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Vault Payout — ' || inv.plan_name,
    'type', 'investment',
    'amount', v_total,
    'unit', 'XENA',
    'timestamp', 'Just now',
    'status', 'Completed',
    'paymentMethod', 'Vault Payout',
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-po-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Vault Payout Received',
    'message', 'Your ' || inv.plan_name || ' vault paid out ' || v_total || ' XENA (principal + yield) to your balance.',
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );
  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + v_total)::numeric::text::jsonb),
      '{investedXena}',
      (greatest(0, (balances->>'investedXena')::numeric - inv.invested_xena))::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where id = inv.user_id;
  update public.investments set status = 'matured', ended_at = now(), admin_note = p_note, updated_at = now() where id = p_investment_id;
  return jsonb_build_object('ok', true, 'paid', v_total);
end $$;

create or replace function public.admin_payout_all_vaults()
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int := 0; r uuid; res jsonb;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  for r in select id from public.investments where status in ('active', 'matured') and days_remaining <= 0 loop
    res := public.admin_payout_investment(r, 'Auto payout run');
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'processed', n);
end $$;

--
-- VAULT CATALOG (admin edits are write-through and appear immediately)
--

create or replace function public.admin_update_vault(p_vault_id text, updates jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  update public.vault_catalog set
    name = coalesce(updates->>'name', name),
    category = coalesce(updates->>'category', category),
    apy = coalesce((updates->>'apy')::numeric, apy),
    duration = coalesce(updates->>'duration', duration),
    days = coalesce((updates->>'days')::int, days),
    min_deposit = coalesce((updates->>'minDeposit')::numeric, min_deposit),
    badge = coalesce(updates->>'badge', badge),
    risk = coalesce(updates->>'risk', risk),
    description = coalesce(updates->>'description', description),
    active = coalesce((updates->>'active')::boolean, active)
  where id = p_vault_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Vault not found.'); end if;
  return jsonb_build_object('ok', true, 'vault', (select to_jsonb(c) from public.vault_catalog c where c.id = p_vault_id));
end $$;

create or replace function public.admin_add_vault(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare new_id text;
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  new_id := coalesce(payload->>'id', 'cat-' || substr(gen_random_uuid()::text, 1, 8));
  insert into public.vault_catalog (id, name, category, apy, duration, days, min_deposit, badge, risk, description, active, sort_order)
  values (
    new_id, payload->>'name', coalesce(payload->>'category', 'Flexible'),
    coalesce((payload->>'apy')::numeric, 0), coalesce(payload->>'duration', 'Flexible'),
    coalesce((payload->>'days')::int, 0), coalesce((payload->>'minDeposit')::numeric, 1),
    coalesce(payload->>'badge', ''), coalesce(payload->>'risk', 'Low Risk'),
    coalesce(payload->>'description', ''), coalesce((payload->>'active')::boolean, true),
    coalesce((select max(sort_order) from public.vault_catalog), 0) + 1
  );
  return jsonb_build_object('ok', true, 'id', new_id);
end $$;

create or replace function public.admin_delete_vault(p_vault_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'Admin access required.'); end if;
  delete from public.vault_catalog where id = p_vault_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Vault not found.'); end if;
  return jsonb_build_object('ok', true);
end $$;

--
-- PAYMENTS (server-side ledger + idempotent auto-credit)
--

-- Drop EVERY overload so the meta-enabled signature stays unique.
do $$
declare r record;
begin
  for r in (
    select n.nspname, p.proname, p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_pending_payment'
  ) loop
    execute format('drop function %I.%I(%s)', r.nspname, r.proname, pg_get_function_identity_arguments(r.oid));
  end loop;
end $$;

create or replace function public.record_pending_payment(p_reference text, p_provider text, p_amount numeric, p_currency text, p_email text, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u uuid; v_meta jsonb;
begin
  select id into u from public.profiles where lower(email) = lower(p_email);
  if u is null then return jsonb_build_object('ok', false, 'error', 'Unknown user.'); end if;
  v_meta := coalesce(p_meta, '{}'::jsonb);
  if exists (select 1 from public.payments where reference = p_reference) then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;
  insert into public.payments (user_id, email, provider, reference, amount, currency, status, meta)
  values (u, lower(p_email), p_provider, p_reference, p_amount, p_currency, 'pending', v_meta);
  return jsonb_build_object('ok', true, 'existing', false);
end $$;

-- Drop EVERY overload so the meta-enabled signature replaces it
-- instead of overloading (prevents 42725 function not unique).
do $$
declare r record;
begin
  for r in (
    select n.nspname, p.proname, p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'credit_payment'
  ) loop
    execute format('drop function %I.%I(%s)', r.nspname, r.proname, pg_get_function_identity_arguments(r.oid));
  end loop;
end $$;

create or replace function public.credit_payment(p_reference text, p_provider text, p_amount numeric, p_currency text, p_xena numeric, p_email text, p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  tx jsonb;
  notif jsonb;
  v_coin text;
  v_price numeric;
  v_rate numeric;
  v_bonus_xena numeric := 0;
  v_bonus_title text;
  v_bonus_msg text;
  v_first boolean;
begin
  select * into pay from public.payments where reference = p_reference;
  if pay.id is not null and pay.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'duplicate', true, 'xena', pay.xena);
  end if;

  -- Per-method first-deposit bonus: the first ever NGN deposit for this email
  -- unlocks ₦1,500; the first ever crypto deposit unlocks a $10 crypto bonus.
  v_coin := lower(coalesce(p_meta->>'coin', ''));
  v_first := false;
  if p_provider = 'flutterwave' then
    select not exists (
      select 1 from public.payments where lower(email) = lower(p_email) and provider = 'flutterwave' and status = 'confirmed'
    ) into v_first;
  elsif p_provider = 'nowpayments' then
    select not exists (
      select 1 from public.payments where lower(email) = lower(p_email) and provider = 'nowpayments' and status = 'confirmed'
    ) into v_first;
  end if;

  if v_first then
    v_price := coalesce((select (value->>'price')::numeric from public.xena_settings where key = 'price'), 2.85);
    v_rate := coalesce((select (value->>'ngnRate')::numeric from public.xena_settings where key = 'xena_ngn_rate'),
      coalesce((select (value->>'xenaNgnRate')::numeric from public.xena_settings where key = 'limits'), 1500));
    if p_provider = 'flutterwave' and p_currency = 'NGN' then
      v_bonus_xena := round(1500 / v_rate, 4); -- ₦1,500 welcome bonus
      v_bonus_title := 'Welcome Bonus — ₦1,500';
      v_bonus_msg := 'Your first NGN deposit unlocked a ₦1,500 bonus. +' || round(1500 / v_rate, 4)::text || ' XENA credited.';
    elsif p_provider = 'nowpayments' and p_currency = 'USD' then
      v_bonus_xena := round(10 / v_price, 4); -- $10 crypto welcome bonus (any stablecoin/crypto coin)
      v_bonus_title := 'Welcome Bonus — $10';
      v_bonus_msg := 'Your first crypto deposit unlocked a $10 bonus. +' || round(10 / v_price, 4)::text || ' XENA credited.';
    end if;
  end if;

  tx := jsonb_build_object(
    'id', 'tx-pay-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Deposit via ' || case when p_provider = 'flutterwave' then 'Flutterwave (NGN)'
      when p_provider = 'paystack' then 'Paystack (NGN)' else 'Crypto Payment Processor' end,
    'type', 'deposit',
    'amount', p_xena,
    'unit', 'XENA',
    'status', 'Completed',
    'timestamp', 'Just now',
    'paymentMethod', case when p_provider = 'flutterwave' then 'Flutterwave · NGN'
      when p_provider = 'paystack' then 'Paystack Card/Bank' else p_provider end,
    'counterparty', 'XENA Payments',
    'fee', 0
  );
  notif := jsonb_build_object(
    'id', 'notif-pay-' || substr(gen_random_uuid()::text, 1, 8),
    'title', 'Deposit Confirmed',
    'message', '+' || p_xena || ' XENA has been credited to your balance (ref ' || p_reference || ').',
    'timestamp', 'Just now', 'read', false, 'type', 'transaction'
  );

  if v_bonus_xena > 0 then
    tx := jsonb_build_object(
      'id', 'tx-bonus-' || substr(gen_random_uuid()::text, 1, 8),
      'title', v_bonus_title,
      'type', 'bonus',
      'amount', v_bonus_xena,
      'unit', 'XENA',
      'status', 'Completed',
      'timestamp', 'Just now',
      'paymentMethod', 'Welcome Bonus',
      'counterparty', 'XENA Payments',
      'fee', 0
    );
    notif := jsonb_build_object(
      'id', 'notif-bonus-' || substr(gen_random_uuid()::text, 1, 8),
      'title', v_bonus_title,
      'message', v_bonus_msg,
      'timestamp', 'Just now', 'read', false, 'type', 'transaction'
    );
  end if;

  update public.profiles set
    balances = jsonb_set(
      jsonb_set(balances, '{availableXena}', ((balances->>'availableXena')::numeric + p_xena + v_bonus_xena)::numeric::text::jsonb),
      '{totalBalance}',
      ((balances->>'totalBalance')::numeric + p_xena + v_bonus_xena)::numeric::text::jsonb
    ),
    transactions = jsonb_build_array(tx) || transactions,
    notifications = jsonb_build_array(notif) || notifications,
    updated_at = now()
  where lower(email) = lower(p_email);

  insert into public.payments (user_id, email, provider, reference, amount, currency, xena, status, meta, confirmed_at)
  select id, lower(p_email), p_provider, p_reference, p_amount, p_currency, p_xena + v_bonus_xena, 'confirmed', coalesce(p_meta, '{}'::jsonb), now()
  from public.profiles where lower(email) = lower(p_email)
  on conflict (reference) do update set
    xena = excluded.xena, status = 'confirmed', meta = excluded.meta, confirmed_at = now(), updated_at = now();

  return jsonb_build_object('ok', true, 'xena', p_xena + v_bonus_xena, 'bonus', v_bonus_xena);
end $$;

--
-- CLIENT-SIDE PAYMENTS via Postgres http extension (no Vercel serverless needed)
-- The Vercel /api/* serverless functions are broken (FUNCTION_INVOCATION_TIMEOUT).
-- Secrets live ONLY in payment_secrets (RLS blocks clients); the DB calls the
-- payment providers directly.
--
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
    jsonb_build_object('Authorization', 'Bearer ' || v_secret)
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
    jsonb_build_object('Authorization', 'Bearer ' || v_secret)
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
    jsonb_build_object('x-api-key', v_api_key)
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
    jsonb_build_object('x-api-key', v_api_key)
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

--
-- PROMO CODE REDEMPTION (server-validated, one claim per account per code)
-- Codes are defined in xena_settings key 'promos' as a jsonb array of
-- {code, rewardXena, label, description, active}. Unknown codes are rejected.
--

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
    'title', '🎁 Bonus Voucher Claimed!',
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

--
-- GRANTS
--

grant usage on schema public to anon, authenticated;
grant select on table public.announcements to anon, authenticated;
grant select on table public.xena_settings to anon, authenticated;
grant select on table public.vault_catalog to anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant select on table public.investments to anon, authenticated;
grant select on table public.p2p_offers to anon, authenticated;
grant select on table public.p2p_trades to anon, authenticated;
grant select on table public.support_conversations to anon, authenticated;
grant select on table public.payments to anon, authenticated;
grant select on table public.withdrawal_requests to anon, authenticated;
grant select on table public.admin_state to authenticated;

grant execute on function public.get_public_state to anon, authenticated;
grant execute on function public.get_my_state to authenticated;
grant execute on function public.admin_get_state to authenticated;
grant execute on function public.save_account_profile to authenticated;
grant execute on function public.redeem_promo_code to authenticated;
grant execute on function public.is_admin to authenticated;
grant execute on function public.current_email to anon, authenticated;

grant execute on function public.submit_p2p_offer to authenticated;
grant execute on function public.approve_p2p_offer to authenticated;
grant execute on function public.reject_p2p_offer to authenticated;
grant execute on function public.admin_p2p_move to authenticated;
grant execute on function public.submit_p2p_payment to authenticated;
grant execute on function public.approve_p2p_payment to authenticated;
grant execute on function public.reject_p2p_payment to authenticated;

grant execute on function public.get_support_conversations to authenticated;
grant execute on function public.send_support_message to authenticated;
grant execute on function public.reply_support_conversation to authenticated;
grant execute on function public.resolve_support_conversation to authenticated;

grant execute on function public.admin_set_price to authenticated;
grant execute on function public.admin_update_limits to authenticated;
grant execute on function public.admin_update_settings to authenticated;
grant execute on function public.admin_save_state to authenticated;
grant execute on function public.admin_replace_announcements to authenticated;
grant execute on function public.admin_replace_promos to authenticated;
grant execute on function public.admin_adjust_balance to authenticated;
grant execute on function public.admin_delete_profile to authenticated;

grant execute on function public.create_withdrawal_request to authenticated;
grant execute on function public.admin_decide_withdrawal to authenticated;

grant execute on function public.user_stake_vault to authenticated;
grant execute on function public.user_claim_yield to authenticated;
grant execute on function public.accrue_investments to service_role;
grant execute on function public.admin_restart_investment to authenticated;
grant execute on function public.admin_cancel_investment to authenticated;
grant execute on function public.admin_payout_investment to authenticated;
grant execute on function public.admin_payout_all_vaults to authenticated;
grant execute on function public.admin_update_vault to authenticated;
grant execute on function public.admin_add_vault to authenticated;
grant execute on function public.admin_delete_vault to authenticated;

grant execute on function public.record_pending_payment to authenticated, service_role;
grant execute on function public.credit_payment to authenticated, service_role;

grant execute on function public.client_create_flutterwave_deposit to authenticated;
grant execute on function public.client_verify_flutterwave_deposit to authenticated;
grant execute on function public.client_create_crypto_invoice to authenticated;
grant execute on function public.client_check_crypto_deposit to authenticated;