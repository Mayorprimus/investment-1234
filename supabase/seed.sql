--
-- XENA Exchange — Supabase seed (run AFTER migration.sql in the SQL editor)
-- Creates the ONLY admin account, the showcase user, dashboard blobs,
-- announcements, vault catalog, global settings, and a couple of P2P ads.
--

--
-- 1) AUTH USERS  (email confirmed — instant login, no confirmation needed)
--

-- ADMIN ACCOUNT — ONLY admin12345@gmail.com has role='admin' and can access
-- the admin portal. Its password is admin12345 (bcrypt-hashed below).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'admin12345@gmail.com',
  crypt('admin12345', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Administrator"}',
  now(), now(), false, false
) on conflict do nothing;

-- SHOWCASE USER — alex.morgan@xena.fi / xena-user-demo
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'alex.morgan@xena.fi',
  crypt('xena-user-demo', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Alex Morgan"}',
  now(), now(), false, false
) on conflict do nothing;

--
-- 2) PROFILES
--

-- Admin profile: xena_id XN-ADMIN-01, role='admin' (the ONLY admin).
insert into public.profiles (
  id, email, name, country, phone, dob, referrer,
  xena_id, xena_code, kyc_tier, status, role, two_factor_enabled, pin_set,
  verified_accounts_count, balances, transactions, notifications, redeemed_bonus_codes
)
select id, 'admin12345@gmail.com', 'Administrator', 'Nigeria', '', '', '',
       'XN-ADMIN-01', 'xena-admin', 'Staff', 'Active', 'admin', true, true, 5,
       '{"totalXena":0,"totalBalance":0,"usdRate":1,"change24hAmount":0,"change24hPercent":0,"availableXena":0,"investedXena":0,"averageBuyPrice":0,"currentPrice":2.85,"stakedXena":0,"lockedInOrders":0,"nairaBalance":0,"xenaNgnRate":1500}'::jsonb,
       '[]'::jsonb,
       '[]'::jsonb,
       '[]'::jsonb
from auth.users where email = 'admin12345@gmail.com'
on conflict (id) do update set role = 'admin';

-- Showcase user profile (rich seeded balance, like the old demo account).
insert into public.profiles (
  id, email, name, country, phone, dob, referrer,
  xena_id, xena_code, kyc_tier, status, role, two_factor_enabled, pin_set,
  verified_accounts_count, balances, transactions, notifications, redeemed_bonus_codes
)
select id, 'alex.morgan@xena.fi', 'Alex Morgan', 'Canada', '+1 416 555 0198', '1991-04-18', '',
       'XN-000001', 'ALEX-X', 'Tier 2', 'Active', 'user', true, true, 2,
       jsonb_build_object(
         'totalXena', 2850.5, 'totalBalance', 2850.5, 'usdRate', 1.0,
         'change24hAmount', 320.5, 'change24hPercent', 12.65,
         'availableXena', 2850.5, 'investedXena', 23.0, 'averageBuyPrice', 2.15,
         'currentPrice', 2.85, 'stakedXena', 0, 'lockedInOrders', 0,
         'nairaBalance', 2450000.0, 'xenaNgnRate', 1500
       ),
       jsonb_build_array(
         jsonb_build_object('id','tx-seed-1','title','Deposit','type','deposit','amount',500,'unit','XENA','status','Completed','timestamp','Today, 14:23','paymentMethod','Instant SEPA Bank Transfer','fee',0),
         jsonb_build_object('id','tx-seed-2','title','P2P Sell','type','p2p','amount',120,'unit','XENA','status','Completed','timestamp','Yesterday, 09:12','paymentMethod','NGN Bank Transfer','fee',0,'counterparty','CryptoDesk NG'),
         jsonb_build_object('id','tx-seed-3','title','Staking Yield','type','yield','amount',38.25,'unit','XENA','status','Completed','timestamp','May 22, 2026','paymentMethod','Auto-compound','fee',0)
       ),
       jsonb_build_array(
         jsonb_build_object('id','n-seed-1','title','Welcome to XENA','message','Your secure exchange account is ready. Set up 2FA for extra protection.','timestamp','Just now','read',false,'type','general')
       ),
       '[]'::jsonb
from auth.users where email = 'alex.morgan@xena.fi'
on conflict (id) do nothing;

-- Demo active investment for the showcase user (shows live investment progress).
insert into public.investments (user_id, email, user_name, plan_name, category, invested_xena, apy, total_days, days_remaining, progress_percent, status, started_at)
select id, 'alex.morgan@xena.fi', 'Alex Morgan', '30-Day Growth', 'Fixed Term', 23, 28.0, 30, 30, 0, 'active', now() - interval '3 days'
from auth.users where email = 'alex.morgan@xena.fi';

--
-- 3) VAULT CATALOG  (admin-editable; min_deposit is the XENA stake cost)
--

insert into public.vault_catalog (id, name, category, apy, duration, days, min_deposit, badge, risk, description, active, sort_order) values
  ('cat-flex',    'Micro Starter',  'Flexible',      12.0, 'Flexible',    0,  1.05,  'Instant Redeem', 'Low Risk',   'A tiny low-pressure entry point. Withdraw any time, yield compounds daily.', true, 1),
  ('cat-2wk-sprint','2-Week Sprint','2-Week (14D)',  20.0, '2-Week Lock', 14, 3.51,  '⚡ 2-Week',      'Audited',    'A fast 14-day lock with a friendly APY boost on your starter amount.', true, 2),
  ('cat-2wk-surge','2-Week Surge',  '2-Week (14D)',  24.0, '2-Week Lock', 14, 5.26,  'High Yield',     'Protected',  'Proof-of-stake delegation with 14-day compounding and payout at maturity.', true, 3),
  ('cat-30d',     '30-Day Growth',  'Fixed Term',    28.0, '30-Day Lock', 30, 8.07,  'Popular',        'Audited Strategy', 'A balanced one-month vault routing liquidity for steady amplified yield.', true, 4),
  ('cat-45d',     '45-Day Momentum','Fixed Term',    34.0, '45-Day Lock', 45, 12.28, 'Trending',       'Hedged',     'A mid-term play blending validator yield with defensive hedging.', true, 5),
  ('cat-90d',     'VIP Boost',      'VIP Tier',      42.0, '90-Day Lock', 90, 14.04, 'High APY',       'Protected',  'The top tier — institutional revenue share with maximum compounding power.', true, 6)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, apy = excluded.apy,
  duration = excluded.duration, days = excluded.days, min_deposit = excluded.min_deposit,
  badge = excluded.badge, risk = excluded.risk, description = excluded.description,
  active = excluded.active, sort_order = excluded.sort_order;

--
-- 4) GLOBAL SETTINGS (price, flags, ₦ minimums, escrow contact)
--

insert into public.xena_settings (key, value) values
  ('price',  '{"price": 2.85}'),
  ('xena_ngn_rate', '{"ngnRate": 1500}'),
  ('flags',  '{"maintenanceMode": false, "p2pZeroFee": true, "withdrawApproval": true}'),
  ('limits', '{"min_deposit_ngn": 3000, "min_withdrawal_ngn": 3000}'),
  ('escrow', '{"bank": "Providus Bank", "accountName": "XENA Nigeria Escrow Ltd", "accountNumber": "30-8821-4490", "sortCode": "101", "fee": 500}')
on conflict (key) do update set value = excluded.value;

--
-- 5) ANNOUNCEMENTS
--

insert into public.announcements (id, title, date, tag, tag_color, summary, action_text, action_id) values
  ('ann-1', 'Zero-Fee P2P Trading Carnival is Now Live!', 'May 24, 2026', 'Promotion',
   'bg-emerald-50 text-[#16A34A] border-emerald-100',
   'Trade fiat-to-XENA with 0% maker and taker fees through our verified peer-to-peer network. Over 40 fiat payment channels supported with instant smart escrow protection.',
   'Start P2P Trading', 'p2p'),
  ('ann-2', 'New High-Yield 180-Day Institutional Staking Vault (52.0% APY)', 'May 20, 2026', 'Staking',
   'bg-purple-50 text-[#6D28D9] border-purple-100',
   'We have expanded our decentralized validator delegation pools. Lock your XENA tokens to earn up to 52% APY with daily compounded payouts and automated slashing protection.',
   'View Staking Vaults', 'staking'),
  ('ann-3', 'XENA Network Upgrades to Mainnet v2.4 (Sub-Second Finality)', 'May 15, 2026', 'System Upgrade',
   'bg-blue-50 text-blue-600 border-blue-100',
   'The XENA blockchain layer has successfully transitioned to consensus v2.4, achieving sub-second block finality and gas fee reductions of over 70% across all decentralized transactions.',
   'Explore System Details', null),
  ('ann-4', 'CertiK Complete Security Audit & Proof-of-Reserves Verification', 'May 10, 2026', 'Security',
   'bg-purple-50 text-[#6D28D9] border-purple-100',
   'CertiK has completed its formal verification of all XENA smart contracts with a 99/100 security score. Proof-of-Reserves merkle trees are now updated live on-chain every 6 hours.',
   'View Security Audit', null)
on conflict (id) do update set title = excluded.title, date = excluded.date, tag = excluded.tag,
  tag_color = excluded.tag_color, summary = excluded.summary, action_text = excluded.action_text,
  action_id = excluded.action_id;

--
-- 6) ADMIN DASHBOARD STATE (users/transactions/merchants/disputes/tickets/
--    promos/audit/deposits/referrals/bonus-logs — persisted as one blob)
--

insert into public.admin_state (id, blob) values (1,
  jsonb_build_object(
    'users', jsonb_build_array(
      jsonb_build_object('id','u1','name','Alex Morgan','email','alex.morgan@xena.fi','country','Canada','kycTier','Tier 2','balance',12840,'status','Active'),
      jsonb_build_object('id','u2','name','Fatima Abubakar','email','fatima.a@xena.fi','country','Nigeria','kycTier','Tier 2','balance',4520,'status','Active'),
      jsonb_build_object('id','u3','name','David Chen','email','d.chen@xena.fi','country','Singapore','kycTier','Tier 1','balance',980,'status','Active'),
      jsonb_build_object('id','u4','name','Grace Okafor','email','grace.o@xena.fi','country','Ghana','kycTier','Tier 1','balance',1210,'status','Frozen'),
      jsonb_build_object('id','u5','name','Omar Hassan','email','omar.h@xena.fi','country','UAE','kycTier','Tier 3 (Institutional)','balance',78200,'status','Active'),
      jsonb_build_object('id','u6','name','Lina Kowalski','email','lina.k@xena.fi','country','Poland','kycTier','Tier 2','balance',3360,'status','Active'),
      jsonb_build_object('id','u7','name','Chen Wei','email','chen.wei@xena.fi','country','China','kycTier','Tier 1','balance',540,'status','Pending KYC'),
      jsonb_build_object('id','u8','name','Sara Mensah','email','sara.m@xena.fi','country','Kenya','kycTier','Tier 1','balance',720,'status','Active')
    ),
    'txs', jsonb_build_array(
      jsonb_build_object('id','t1','user','Alex Morgan','type','Deposit','amount',2500,'unit','XENA','status','Completed','time','2 min ago','method','USDT'),
      jsonb_build_object('id','t2','user','Fatima Abubakar','type','Withdrawal','amount',1500,'unit','XENA','status','Pending','time','8 min ago','method','NGN Bank'),
      jsonb_build_object('id','t3','user','Omar Hassan','type','P2P Sell','amount',5000,'unit','XENA','status','Completed','time','22 min ago','method','Escrow'),
      jsonb_build_object('id','t4','user','David Chen','type','Deposit','amount',400,'unit','XENA','status','Completed','time','1 hr ago','method','BTC'),
      jsonb_build_object('id','t5','user','Lina Kowalski','type','Withdrawal','amount',800,'unit','XENA','status','Pending','time','2 hrs ago','method','USDT'),
      jsonb_build_object('id','t6','user','Grace Okafor','type','P2P Buy','amount',200,'unit','XENA','status','Failed','time','3 hrs ago','method','Escrow'),
      jsonb_build_object('id','t7','user','Sara Mensah','type','Investment','amount',50,'unit','XENA','status','Completed','time','5 hrs ago','method','Vault'),
      jsonb_build_object('id','t8','user','Chen Wei','type','Withdrawal','amount',120,'unit','XENA','status','Completed','time','8 hrs ago','method','SOL')
    ),
    'merchants', jsonb_build_array(
      jsonb_build_object('id','m1','name','CryptoDesk NG','owner','Fatima Abubakar','verified',true,'orders',1240,'rating',98.6),
      jsonb_build_object('id','m2','name','QuickXchange','owner','David Chen','verified',false,'orders',312,'rating',92.1),
      jsonb_build_object('id','m3','name','AfriTrade Hub','owner','Sara Mensah','verified',true,'orders',860,'rating',97.2),
      jsonb_build_object('id','m4','name','Gulf Prime','owner','Omar Hassan','verified',true,'orders',2210,'rating',99.1),
      jsonb_build_object('id','m5','name','EuroBridge','owner','Lina Kowalski','verified',false,'orders',145,'rating',88.4)
    ),
    'disputes', jsonb_build_array(
      jsonb_build_object('id','d1','offer','CryptoDesk NG','buyer','User 8842','seller','Fatima Abubakar','amount',1500,'reason','Payment not received','status','Open'),
      jsonb_build_object('id','d2','offer','Gulf Prime','buyer','User 1201','seller','Omar Hassan','amount',3200,'reason','Wrong NGN amount credited','status','Open'),
      jsonb_build_object('id','d3','offer','AfriTrade Hub','buyer','User 5530','seller','Sara Mensah','amount',800,'reason','Seller wants release without proof','status','Escalated')
    ),
    'tickets', jsonb_build_array(
      jsonb_build_object('id','s1','user','Alex Morgan','subject','Withdrawal stuck on Pending','status','Open','priority','High','time','12 min ago'),
      jsonb_build_object('id','s2','user','Omar Hassan','subject','KYC tier upgrade request','status','Open','priority','Medium','time','45 min ago'),
      jsonb_build_object('id','s3','user','Chen Wei','subject','Cannot verify identity documents','status','Pending','priority','High','time','2 hrs ago'),
      jsonb_build_object('id','s4','user','Grace Okafor','subject','Account frozen — appeal','status','Resolved','priority','Low','time','1 day ago')
    ),
    'promos', jsonb_build_array(
      jsonb_build_object('id','p1','code','XENA25','value',25,'unit','USD','used',842,'cap',1000,'active',true),
      jsonb_build_object('id','p2','code','WELCOME10','value',10,'unit','XENA','used',1210,'cap',2500,'active',true),
      jsonb_build_object('id','p3','code','STAKER20','value',20,'unit','USD','used',320,'cap',500,'active',false)
    ),
    'audit', jsonb_build_array(
      jsonb_build_object('id','a1','action','Admin login','actor','Super Admin','detail','Signed in from 192.168.1.4','time','2 min ago'),
      jsonb_build_object('id','a2','action','Wallet freeze','actor','admin@xena.fi','detail','Froze account Grace Okafor','time','1 hr ago'),
      jsonb_build_object('id','a3','action','KYC approval','actor','KYC Officer','detail','Upgraded Chen Wei to Tier 1','time','3 hrs ago'),
      jsonb_build_object('id','a4','action','Payout run','actor','System','detail','Auto-compounded 1,240 vaults','time','6 hrs ago'),
      jsonb_build_object('id','a5','action','Settings change','actor','Super Admin','detail','Maintenance mode disabled','time','1 day ago')
    ),
    'deposits', jsonb_build_array(
      jsonb_build_object('id','dep1','user','Alex Morgan','email','alex.morgan@xena.fi','method','USDT (TRC-20)','amount',2500,'unit','USD','xena',8750,'status','Completed','time','2 min ago'),
      jsonb_build_object('id','dep2','user','Omar Hassan','email','omar.h@xena.fi','method','Bank Transfer (AED)','amount',8000,'unit','USD','xena',28000,'status','Completed','time','22 min ago'),
      jsonb_build_object('id','dep3','user','David Chen','email','d.chen@xena.fi','method','BTC','amount',400,'unit','USD','xena',1400,'status','Completed','time','1 hr ago'),
      jsonb_build_object('id','dep4','user','Sara Mensah','email','sara.m@xena.fi','method','M-Pesa','amount',200,'unit','USD','xena',700,'status','Pending','time','4 hrs ago'),
      jsonb_build_object('id','dep5','user','Lina Kowalski','email','lina.k@xena.fi','method','EUR SEPA','amount',1200,'unit','USD','xena',4200,'status','Completed','time','6 hrs ago'),
      jsonb_build_object('id','dep6','user','Fatima Abubakar','email','fatima.a@xena.fi','method','NGN Bank Transfer','amount',900,'unit','USD','xena',3150,'status','Pending','time','9 hrs ago')
    ),
    'referrals', jsonb_build_array(
      jsonb_build_object('id','r1','user','Fatima Abubakar','refCode','FATIMA-X','count',24,'earned',360),
      jsonb_build_object('id','r2','user','Omar Hassan','refCode','OMAR-X','count',41,'earned',615),
      jsonb_build_object('id','r3','user','Alex Morgan','refCode','ALEX-X','count',18,'earned',270),
      jsonb_build_object('id','r4','user','Sara Mensah','refCode','SARA-X','count',12,'earned',180),
      jsonb_build_object('id','r5','user','David Chen','refCode','DAVID-X','count',6,'earned',90),
      jsonb_build_object('id','r6','user','Lina Kowalski','refCode','LINA-X','count',9,'earned',135)
    ),
    'bonusLog', '[]'::jsonb
  )
) on conflict (id) do update set blob = excluded.blob, updated_at = now();

--
-- 7) P2P ADS — one pending (admin approval demo) + two approved (marketplace)
--

insert into public.p2p_offers (
  id, merchant_name, merchant_tier, completion_rate, completed_orders, orders_count,
  type, price_per_xena, currency, min_limit, max_limit, available_xena,
  payment_methods, payment_method, response_time_minutes, is_online, status,
  listed_by, listed_email, listed_at, sort_order
) values
  ('p2p-ad-pending', 'MexiTrade_Official', 'Pro Merchant', 99.1, 1240, 1240, 'SELL',
   2.8600, 'USD', 100, 2500, 5200,
   '["Bank Transfer", "P2P Wallet"]', 'Bank Transfer, P2P Wallet', 3, true, 'pending',
   'Justin Reyes', 'justin.r@xena.fi', (extract(epoch from now()) * 1000)::bigint, 1000),
  ('p2p-ad-01', 'NordicPay_Official', 'VIP Merchant', 100.0, 1842, 1842, 'BUY',
   2.8500, 'USD', 50, 5000, 8400,
   '["Bank Transfer", "Revolut", "Wise"]', 'Bank Transfer, Revolut, Wise', 2, true, 'approved',
   'Admin', 'admin12345@gmail.com', (extract(epoch from now()) * 1000)::bigint, 1),
  ('p2p-ad-02', 'CryptoExpress_EU', 'Pro Merchant', 99.6, 954, 954, 'BUY',
   2.8450, 'USD', 100, 3000, 4200,
   '["SEPA Instant", "Revolut", "PayPal"]', 'SEPA Instant, Revolut, PayPal', 3, true, 'approved',
   'Admin', 'admin12345@gmail.com', (extract(epoch from now()) * 1000)::bigint, 2)
on conflict (id) do nothing;

--
-- DONE — sign in with admin12345@gmail.com / admin12345 (admin portal),
-- or alex.morgan@xena.fi / xena-user-demo (showcase user).
--