import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_EMAIL = 'admin@xena.fi';

// ---------- Password hashing (Node built-in scrypt, no deps) ----------
// Password records store salt + hash only; plaintext is never persisted.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ---------- Token helpers ----------
function tokenForEmail(email) {
  return (db.tokens || {})[String(email).toLowerCase()] || null;
}
function setToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  db.tokens = db.tokens || {};
  db.tokens[String(email).toLowerCase()] = token;
  saveDb();
  return token;
}
function emailForToken(token) {
  if (!token || !db.tokens) return null;
  for (const email of Object.keys(db.tokens)) {
    if (db.tokens[email] === token) return email;
  }
  return null;
}

// ---------- Account helpers ----------
function sanitizeAccount(acc) {
  if (!acc) return acc;
  const { password, salt, hash, ...rest } = acc;
  return rest;
}

function baseAccount(data) {
  const ts = Date.now().toString();
  return {
    ...data,
    id: `acc-${ts.slice(-6)}`,
    xenaId: `XN-${Math.floor(1000000 + Math.random() * 9000000)}`,
    xenaCode: `xena-${Math.floor(10000000 + Math.random() * 89999999)}`,
    kycTier: 'Tier 1 (Pending)',
    status: 'Active',
    joined: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    twoFactorEnabled: false,
    pinSet: false,
    verifiedAccountsCount: 0,
    settings: {},
    balances: {
      totalXena: 0,
      totalBalance: 0,
      usdRate: 1,
      change24hAmount: 0,
      change24hPercent: 0,
      availableXena: 0,
      investedXena: 0,
      averageBuyPrice: 0,
      currentPrice: 2.85,
      stakedXena: 0,
      lockedInOrders: 0,
      nairaBalance: 0,
    },
    transactions: [],
    investments: [],
    notifications: [],
    redeemedBonusCodes: [],
  };
}

// ---------- Admin check ----------
function isAdminToken(token) {
  return emailForToken(token) === ADMIN_EMAIL;
}
function requireAdminToken(token) {
  if (!token || !isAdminToken(token)) return false;
  return true;
}
function requireUserToken(token) {
  return !!emailForToken(token);
}

const SEED_STATE = {
  users: [
    { id: 'u1', name: 'Alex Morgan', email: 'alex.morgan@xena.fi', country: 'Canada', kycTier: 'Tier 2', balance: 12840, status: 'Active' },
    { id: 'u2', name: 'Fatima Abubakar', email: 'fatima.a@xena.fi', country: 'Nigeria', kycTier: 'Tier 2', balance: 4520, status: 'Active' },
    { id: 'u3', name: 'David Chen', email: 'd.chen@xena.fi', country: 'Singapore', kycTier: 'Tier 1', balance: 980, status: 'Active' },
    { id: 'u4', name: 'Grace Okafor', email: 'grace.o@xena.fi', country: 'Ghana', kycTier: 'Tier 1', balance: 1210, status: 'Frozen' },
    { id: 'u5', name: 'Omar Hassan', email: 'omar.h@xena.fi', country: 'UAE', kycTier: 'Tier 3 (Institutional)', balance: 78200, status: 'Active' },
    { id: 'u6', name: 'Lina Kowalski', email: 'lina.k@xena.fi', country: 'Poland', kycTier: 'Tier 2', balance: 3360, status: 'Active' },
    { id: 'u7', name: 'Chen Wei', email: 'chen.wei@xena.fi', country: 'China', kycTier: 'Tier 1', balance: 540, status: 'Pending KYC' },
    { id: 'u8', name: 'Sara Mensah', email: 'sara.m@xena.fi', country: 'Kenya', kycTier: 'Tier 1', balance: 720, status: 'Active' },
  ],
  txs: [
    { id: 't1', user: 'Alex Morgan', type: 'Deposit', amount: 2500, unit: 'XENA', status: 'Completed', time: '2 min ago', method: 'USDT' },
    { id: 't2', user: 'Fatima Abubakar', type: 'Withdrawal', amount: 1500, unit: 'XENA', status: 'Pending', time: '8 min ago', method: 'NGN Bank' },
    { id: 't3', user: 'Omar Hassan', type: 'P2P Sell', amount: 5000, unit: 'XENA', status: 'Completed', time: '22 min ago', method: 'Escrow' },
    { id: 't4', user: 'David Chen', type: 'Deposit', amount: 400, unit: 'XENA', status: 'Completed', time: '1 hr ago', method: 'BTC' },
    { id: 't5', user: 'Lina Kowalski', type: 'Withdrawal', amount: 800, unit: 'XENA', status: 'Pending', time: '2 hrs ago', method: 'USDT' },
    { id: 't6', user: 'Grace Okafor', type: 'P2P Buy', amount: 200, unit: 'XENA', status: 'Failed', time: '3 hrs ago', method: 'Escrow' },
    { id: 't7', user: 'Sara Mensah', type: 'Investment', amount: 50, unit: 'XENA', status: 'Completed', time: '5 hrs ago', method: 'Vault' },
    { id: 't8', user: 'Chen Wei', type: 'Withdrawal', amount: 120, unit: 'XENA', status: 'Completed', time: '8 hrs ago', method: 'SOL' },
  ],
  merchants: [
    { id: 'm1', name: 'CryptoDesk NG', owner: 'Fatima Abubakar', verified: true, orders: 1240, rating: 98.6 },
    { id: 'm2', name: 'QuickXchange', owner: 'David Chen', verified: false, orders: 312, rating: 92.1 },
    { id: 'm3', name: 'AfriTrade Hub', owner: 'Sara Mensah', verified: true, orders: 860, rating: 97.2 },
    { id: 'm4', name: 'Gulf Prime', owner: 'Omar Hassan', verified: true, orders: 2210, rating: 99.1 },
    { id: 'm5', name: 'EuroBridge', owner: 'Lina Kowalski', verified: false, orders: 145, rating: 88.4 },
  ],
  disputes: [
    { id: 'd1', offer: 'CryptoDesk NG', buyer: 'User 8842', seller: 'Fatima Abubakar', amount: 1500, reason: 'Payment not received', status: 'Open' },
    { id: 'd2', offer: 'Gulf Prime', buyer: 'User 1201', seller: 'Omar Hassan', amount: 3200, reason: 'Wrong NGN amount credited', status: 'Open' },
    { id: 'd3', offer: 'AfriTrade Hub', buyer: 'User 5530', seller: 'Sara Mensah', amount: 800, reason: 'Seller wants release without proof', status: 'Escalated' },
  ],
  tickets: [
    { id: 's1', user: 'Alex Morgan', subject: 'Withdrawal stuck on Pending', status: 'Open', priority: 'High', time: '12 min ago' },
    { id: 's2', user: 'Omar Hassan', subject: 'KYC tier upgrade request', status: 'Open', priority: 'Medium', time: '45 min ago' },
    { id: 's3', user: 'Chen Wei', subject: 'Cannot verify identity documents', status: 'Pending', priority: 'High', time: '2 hrs ago' },
    { id: 's4', user: 'Grace Okafor', subject: 'Account frozen — appeal', status: 'Resolved', priority: 'Low', time: '1 day ago' },
  ],
  promos: [
    { id: 'p1', code: 'XENA25', value: 25, unit: 'USD', used: 842, cap: 1000, active: true },
    { id: 'p2', code: 'WELCOME10', value: 10, unit: 'XENA', used: 1210, cap: 2500, active: true },
    { id: 'p3', code: 'STAKER20', value: 20, unit: 'USD', used: 320, cap: 500, active: false },
  ],
  audit: [
    { id: 'a1', action: 'Admin login', actor: 'Super Admin', detail: 'Signed in from 192.168.1.4', time: '2 min ago' },
    { id: 'a2', action: 'Wallet freeze', actor: 'admin@xena.fi', detail: 'Froze account Grace Okafor', time: '1 hr ago' },
    { id: 'a3', action: 'KYC approval', actor: 'KYC Officer', detail: 'Upgraded Chen Wei to Tier 1', time: '3 hrs ago' },
    { id: 'a4', action: 'Payout run', actor: 'System', detail: 'Auto-compounded 1,240 vaults', time: '6 hrs ago' },
    { id: 'a5', action: 'Settings change', actor: 'Super Admin', detail: 'Maintenance mode disabled', time: '1 day ago' },
  ],
  deposits: [
    { id: 'dep1', user: 'Alex Morgan', email: 'alex.morgan@xena.fi', method: 'USDT (TRC-20)', amount: 2500, unit: 'USD', xena: 8750, status: 'Completed', time: '2 min ago' },
    { id: 'dep2', user: 'Omar Hassan', email: 'omar.h@xena.fi', method: 'Bank Transfer (AED)', amount: 8000, unit: 'USD', xena: 28000, status: 'Completed', time: '22 min ago' },
    { id: 'dep3', user: 'David Chen', email: 'd.chen@xena.fi', method: 'BTC', amount: 400, unit: 'USD', xena: 1400, status: 'Completed', time: '1 hr ago' },
    { id: 'dep4', user: 'Sara Mensah', email: 'sara.m@xena.fi', method: 'M-Pesa', amount: 200, unit: 'USD', xena: 700, status: 'Pending', time: '4 hrs ago' },
    { id: 'dep5', user: 'Lina Kowalski', email: 'lina.k@xena.fi', method: 'EUR SEPA', amount: 1200, unit: 'USD', xena: 4200, status: 'Completed', time: '6 hrs ago' },
    { id: 'dep6', user: 'Fatima Abubakar', email: 'fatima.a@xena.fi', method: 'NGN Bank Transfer', amount: 900, unit: 'USD', xena: 3150, status: 'Pending', time: '9 hrs ago' },
  ],
  referrals: [
    { id: 'r1', user: 'Fatima Abubakar', refCode: 'FATIMA-X', count: 24, earned: 360 },
    { id: 'r2', user: 'Omar Hassan', refCode: 'OMAR-X', count: 41, earned: 615 },
    { id: 'r3', user: 'Alex Morgan', refCode: 'ALEX-X', count: 18, earned: 270 },
    { id: 'r4', user: 'Sara Mensah', refCode: 'SARA-X', count: 12, earned: 180 },
    { id: 'r5', user: 'David Chen', refCode: 'DAVID-X', count: 6, earned: 90 },
    { id: 'r6', user: 'Lina Kowalski', refCode: 'LINA-X', count: 9, earned: 135 },
  ],
  bonusLog: [],
  p2pOffers: [],
  p2pTrades: [],
  supportConvs: [],
  announcements: [
    {
      id: 'ann-1',
      title: 'Zero-Fee P2P Trading Carnival is Now Live!',
      date: 'May 24, 2026',
      tag: 'Promotion',
      tagColor: 'bg-emerald-50 text-[#16A34A] border-emerald-100',
      summary: 'Trade fiat-to-XENA with 0% maker and taker fees through our verified peer-to-peer network. Over 40 fiat payment channels supported with instant smart escrow protection.',
      actionText: 'Start P2P Trading',
      actionId: 'p2p',
    },
    {
      id: 'ann-2',
      title: 'New High-Yield 180-Day Institutional Staking Vault (52.0% APY)',
      date: 'May 20, 2026',
      tag: 'Staking',
      tagColor: 'bg-purple-50 text-[#6D28D9] border-purple-100',
      summary: 'We have expanded our decentralized validator delegation pools. Lock your XENA tokens to earn up to 52% APY with daily compounded payouts and automated slashing protection.',
      actionText: 'View Staking Vaults',
      actionId: 'staking',
    },
    {
      id: 'ann-3',
      title: 'XENA Network Upgrades to Mainnet v2.4 (Sub-Second Finality)',
      date: 'May 15, 2026',
      tag: 'System Upgrade',
      tagColor: 'bg-blue-50 text-blue-600 border-blue-100',
      summary: 'The XENA blockchain layer has successfully transitioned to consensus v2.4, achieving sub-second block finality and gas fee reductions of over 70% across all decentralized transactions.',
      actionText: 'Explore System Details',
    },
    {
      id: 'ann-4',
      title: 'CertiK Complete Security Audit & Proof-of-Reserves Verification',
      date: 'May 10, 2026',
      tag: 'Security',
      tagColor: 'bg-purple-50 text-[#6D28D9] border-purple-100',
      summary: 'CertiK has completed its formal verification of all XENA smart contracts with a 99/100 security score. Proof-of-Reserves merkle trees are now updated live on-chain every 6 hours.',
      actionText: 'View Security Audit',
    },
  ],
  settings: { maintenanceMode: false, p2pZeroFee: true, withdrawApproval: true },
  xenaPrice: 2.85,
  accounts: [],
  tokens: {},
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (err) {
    console.error('Failed to read data/db.json, re-seeding.', err);
  }
  return JSON.parse(JSON.stringify(SEED_STATE));
}

let db = loadDb();

// Showcase account (rich seeded profile), created server-side with a real
// scrypt hash so the demo login works via normal auth — no client fallback.
function seedShowcaseAccount() {
  const email = 'alex.morgan@xena.fi';
  if ((db.accounts || []).some((a) => a.email === email)) return;
  const { salt, hash } = hashPassword('xena-user-demo');
  const balance = {
    totalXena: 2850.5, usdRate: 1.0, change24hAmount: 320.5, change24hPercent: 12.65,
    availableXena: 2850.5, investedXena: 0, averageBuyPrice: 2.15, currentPrice: db.xenaPrice || 2.85,
    stakedXena: 0, lockedInOrders: 0, nairaBalance: 2450000,
  };
  db.accounts = db.accounts || [];
  db.accounts.unshift({
    name: 'Alex Morgan', email, country: 'Canada', phone: '+1 416 555 0198', dob: '1991-04-18', referrer: '',
    id: 'acct-alex', xenaId: 'XN-000001', xenaCode: 'ALEX-X', kycTier: 'Tier 2', status: 'Active',
    joined: new Date().toLocaleDateString(), twoFactorEnabled: true, pinSet: true, verifiedAccountsCount: 2,
    salt, hash,
    balances: balance,
    transactions: [
      { id: 'tx-seed-1', title: 'Deposit', type: 'deposit', amount: 500, unit: 'XENA', status: 'Completed', timestamp: 'Today, 14:23', paymentMethod: 'Instant SEPA Bank Transfer', fee: 0 },
      { id: 'tx-seed-2', title: 'P2P Sell', type: 'p2p', amount: 120, unit: 'XENA', status: 'Completed', timestamp: 'Yesterday, 09:12', paymentMethod: 'NGN Bank Transfer', fee: 0, counterparty: 'CryptoDesk NG' },
      { id: 'tx-seed-3', title: 'Staking Yield', type: 'yield', amount: 38.25, unit: 'XENA', status: 'Completed', timestamp: 'May 22, 2026', paymentMethod: 'Auto-compound', fee: 0 },
    ],
    investments: [],
    notifications: [
      { id: 'n-seed-1', title: 'Welcome to XENA', message: 'Your secure exchange account is ready. Set up 2FA for extra protection.', timestamp: 'Just now', read: false, type: 'general' },
    ],
    redeemedBonusCodes: [],
  });
  saveDb();
}

seedShowcaseAccount();

function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('Failed to persist data/db.json.', err);
  }
}

const app = express();
// Stash the raw request buffer so webhook HMAC verification (NOWPayments IPN)
// can sign exactly what the provider sent, not a re-serialization.
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      if (buf && buf.length) req.rawBody = buf;
    },
  })
);

app.get('/api/state', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const publicAccounts = Array.isArray(db.accounts) ? db.accounts.map(sanitizeAccount) : db.accounts;
  res.json({ ...db, accounts: publicAccounts });
});

// Admin/global data mutations. Accounts are NEVER writable here — they only
// change through the authenticated account/login/register endpoints so that
// hashes and balances stay safe and per-user.
app.post('/api/state', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ ok: false, error: 'Invalid payload' });
    return;
  }
  for (const key of Object.keys(body)) {
    if (key === 'accounts' || key === 'tokens' || key === 'p2pOffers' || key === 'p2pTrades') continue;
    db[key] = body[key];
  }
  saveDb();
  res.json({ ok: true });
});

// ---------- Authentication----------- 
app.post('/api/register', (req, res) => {
  const { name, email, password, country, phone, dob, referrer } = req.body || {};
  const e = String(email || '').trim().toLowerCase();
  if (!name || !e || !password) {
    res.status(400).json({ ok: false, error: 'Missing required fields.' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ ok: false, error: 'Password must be at least 8 characters long.' });
    return;
  }
  const existing = (db.accounts || []).find((a) => a.email === e);
  if (existing) {
    res.status(400).json({ ok: false, error: 'An account with this email already exists.' });
    return;
  }
  const { salt, hash } = hashPassword(String(password));
  const acc = baseAccount({ name, email: e, password: undefined, country, phone, dob, referrer });
  acc.salt = salt;
  acc.hash = hash;
  delete acc.password;
  db.accounts = [acc, ...(db.accounts || [])];
  const token = setToken(e);
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, account: sanitizeAccount(acc), token });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const e = String(email || '').trim().toLowerCase();
  if (!e || !password) {
    res.status(400).json({ ok: false, error: 'Missing email or password.' });
    return;
  }
  if (e === 'admin@xena.fi' && String(password) === 'xena-admin-demo') {
    const token = setToken(e);
    saveDb();
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, role: 'admin', token });
    return;
  }
  const acc = (db.accounts || []).find((a) => a.email === e);
  if (!acc) {
    res.status(400).json({ ok: false, error: 'No account found with that email.' });
    return;
  }
  if (!verifyPassword(String(password), acc.salt, acc.hash)) {
    res.status(400).json({ ok: false, error: 'Incorrect password. Please try again.' });
    return;
  }
  const token = tokenForEmail(e) || setToken(e);
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, role: 'user', account: sanitizeAccount(acc), token });
});

// Persist the signed-in account's mutable session data (bal/transactions/...).
app.post('/api/account/save', (req, res) => {
  const { token, updates } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const idx = (db.accounts || []).findIndex((a) => a.email === email);
  if (idx === -1) {
    res.status(404).json({ ok: false, error: 'Account not found.' });
    return;
  }
  db.accounts[idx] = { ...db.accounts[idx], ...(updates || {}) };
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

// Change password for the signed-in account (re-hashed server-side).
app.post('/api/account/password', (req, res) => {
  const { token, currentPassword, newPassword } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const acc = (db.accounts || []).find((a) => a.email === email);
  if (!acc) {
    res.status(404).json({ ok: false, error: 'Account not found.' });
    return;
  }
  if (!verifyPassword(String(currentPassword || ''), acc.salt, acc.hash)) {
    res.status(400).json({ ok: false, error: 'Current password is incorrect.' });
    return;
  }
  if (!newPassword || String(newPassword).length < 8) {
    res.status(400).json({ ok: false, error: 'New password must be at least 8 characters long.' });
    return;
  }
  const { salt, hash } = hashPassword(String(newPassword));
  acc.salt = salt;
  acc.hash = hash;
  saveDb();
  res.json({ ok: true });
});

// ---------- Admin: Set XENA Price (global, reflected everywhere) ----------
app.post('/api/admin/price', (req, res) => {
  const { token, price } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const p = Number(price);
  if (!p || p <= 0) {
    res.status(400).json({ ok: false, error: 'Enter a valid price greater than 0.' });
    return;
  }
  db.xenaPrice = Math.round(p * 10000) / 10000;
  saveDb();
  res.json({ ok: true, price: db.xenaPrice });
});

// ---------- Admin: Adjust User Balance ----------
app.post('/api/admin/adjust-balance', (req, res) => {
  const { token, targetEmail, amount, memo } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const e = String(targetEmail || '').trim().toLowerCase();
  const adj = Number(amount) || 0;
  if (!e || !adj) {
    res.status(400).json({ ok: false, error: 'Missing target email or amount.' });
    return;
  }
  const acc = (db.accounts || []).find((a) => a.email === e);
  if (!acc) {
    res.status(404).json({ ok: false, error: 'No account found with that email.' });
    return;
  }
  acc.balances = acc.balances || {};
  acc.balances.availableXena = Math.max(0, (acc.balances.availableXena || 0) + adj);
  acc.balances.totalBalance = Math.max(0, (acc.balances.totalBalance || 0) + adj);
  acc.transactions = acc.transactions || [];
  acc.transactions.unshift({
    id: `tx-admin-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    title: adj >= 0 ? `Admin Credit — ${memo || 'Balance adjustment'}` : `Admin Debit — ${memo || 'Balance adjustment'}`,
    type: adj >= 0 ? 'deposit' : 'withdrawal',
    amount: Math.abs(adj),
    unit: 'XENA',
    status: 'Completed',
    timestamp: new Date().toLocaleString(),
    counterparty: 'XENA Admin',
    paymentMethod: 'Admin Adjustment',
    fee: 0,
  });
  acc.notifications = acc.notifications || [];
  acc.notifications.unshift({
    id: `notif-admin-${Date.now()}`,
    title: adj >= 0 ? 'Balance Credited by Admin' : 'Balance Debited by Admin',
    message: adj >= 0
      ? `Admin added ${Math.abs(adj)} XENA to your balance. ${memo ? `Reason: ${memo}` : ''}`
      : `Admin removed ${Math.abs(adj)} XENA from your balance. ${memo ? `Reason: ${memo}` : ''}`,
    timestamp: 'Just now',
    read: false,
    type: 'transaction',
  });
  saveDb();
  res.json({ ok: true, newBalance: acc.balances.availableXena });
});

// ---------- Admin: Delete User Account ----------
app.post('/api/admin/delete-account', (req, res) => {
  const { token, targetEmail } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const e = String(targetEmail || '').trim().toLowerCase();
  if (!e) {
    res.status(400).json({ ok: false, error: 'Missing target email.' });
    return;
  }
  const idx = (db.accounts || []).findIndex((a) => a.email === e);
  if (idx === -1) {
    res.status(404).json({ ok: false, error: 'No account found with that email.' });
    return;
  }
  db.accounts.splice(idx, 1);
  if (db.tokens && db.tokens[e]) delete db.tokens[e];
  db.supportConvs = (db.supportConvs || []).filter((c) => c.email !== e);
  saveDb();
  res.json({ ok: true });
});

// ---------- Support Conversations (user messages + admin replies) ----------
const convFor = (email) => (db.supportConvs || []).find((c) => c.email === email);

app.post('/api/support/conversations', (req, res) => {
  const { token } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  let list = db.supportConvs || [];
  if (email !== ADMIN_EMAIL) {
    list = list.filter((c) => c.email === email);
    if (list.length === 0 && req.body.ensure !== false) {
      const acc = (db.accounts || []).find((a) => a.email === email);
      list = [{
        id: `cs-${Date.now()}-${Math.floor(Math.random() * 999)}`,
        email,
        userName: acc ? acc.name : '',
        status: 'open',
        createdAt: Date.now(),
        messages: [],
      }];
      db.supportConvs = db.supportConvs || [];
      db.supportConvs.push(list[0]);
      saveDb();
    }
  }
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, conversations: list });
});

app.post('/api/support/messages', (req, res) => {
  const { token, text } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const t = String(text || '').trim();
  if (!t) {
    res.status(400).json({ ok: false, error: 'Message cannot be empty.' });
    return;
  }
  db.supportConvs = db.supportConvs || [];
  let conv = convFor(email);
  if (!conv) {
    const acc = (db.accounts || []).find((a) => a.email === email);
    conv = {
      id: `cs-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      email,
      userName: acc ? acc.name : '',
      status: 'open',
      createdAt: Date.now(),
      messages: [],
    };
    db.supportConvs.push(conv);
  }
  conv.messages = conv.messages || [];
  conv.messages.push({ from: 'user', text: t, time: new Date().toLocaleString() });
  conv.status = 'open';
  conv.updatedAt = Date.now();
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, conversation: conv });
});

app.post('/api/support/reply', (req, res) => {
  const { token, email, text } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const e = String(email || '').trim().toLowerCase();
  const t = String(text || '').trim();
  if (!e || !t) {
    res.status(400).json({ ok: false, error: 'Missing email or reply text.' });
    return;
  }
  db.supportConvs = db.supportConvs || [];
  let conv = convFor(e);
  if (!conv) {
    const acc = (db.accounts || []).find((a) => a.email === e);
    conv = {
      id: `cs-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      email: e,
      userName: acc ? acc.name : e,
      status: 'open',
      createdAt: Date.now(),
      messages: [],
    };
    db.supportConvs.push(conv);
  }
  conv.messages = conv.messages || [];
  conv.messages.push({ from: 'agent', text: t, time: new Date().toLocaleString() });
  conv.status = 'open';
  conv.updatedAt = Date.now();
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, conversation: conv });
});

app.post('/api/support/resolve', (req, res) => {
  const { token, conversationId, status } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const conv = (db.supportConvs || []).find((c) => c.id === conversationId);
  if (!conv) {
    res.status(404).json({ ok: false, error: 'Conversation not found.' });
    return;
  }
  conv.status = status === 'resolved' ? 'resolved' : 'open';
  saveDb();
  res.json({ ok: true, status: conv.status });
});

// ---------- P2P Listings & Payment Validation (admin approval required) ----------
app.post('/api/p2p/offer', (req, res) => {
  const { token, offer } = req.body || {};
  const email = emailForToken(token);
  if (!requireUserToken(token)) {
    res.status(401).json({ ok: false, error: 'You must be signed in to post an ad.' });
    return;
  }
  const newOffer = {
    id: offer.id || `p2p-ad-${Date.now()}`,
    merchantName: offer.merchantName || email,
    merchantTier: offer.merchantTier || 'Verified Trader',
    completionRate: offer.completionRate ?? 100,
    completedOrders: offer.completedOrders ?? 0,
    ordersCount: offer.ordersCount ?? 0,
    type: offer.type,
    pricePerXena: Number(offer.pricePerXena) || 2.85,
    currency: offer.currency || 'USD',
    minLimit: Number(offer.minLimit) || 50,
    maxLimit: Number(offer.maxLimit) || 2500,
    availableXena: Number(offer.availableXena) || 1000,
    paymentMethods: offer.paymentMethods || ['Bank Transfer'],
    paymentMethod: offer.paymentMethod || (offer.paymentMethods || []).join(', '),
    responseTimeMinutes: offer.responseTimeMinutes ?? 2,
    isOnline: true,
    status: 'pending',
    listedBy: email,
    listedAt: Date.now(),
  };
  db.p2pOffers = [newOffer, ...(db.p2pOffers || [])];
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, offer: newOffer });
});

app.post('/api/p2p/offer/approve', (req, res) => {
  const { token, offerId } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const offer = (db.p2pOffers || []).find((o) => o.id === offerId);
  if (!offer) {
    res.status(404).json({ ok: false, error: 'Offer not found.' });
    return;
  }
  offer.status = 'approved';
  saveDb();
  res.json({ ok: true });
});

app.post('/api/p2p/offer/reject', (req, res) => {
  const { token, offerId } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const offer = (db.p2pOffers || []).find((o) => o.id === offerId);
  if (!offer) {
    res.status(404).json({ ok: false, error: 'Offer not found.' });
    return;
  }
  offer.status = 'rejected';
  saveDb();
  res.json({ ok: true });
});

app.post('/api/p2p/payment', (req, res) => {
  const { token, trade } = req.body || {};
  const email = emailForToken(token);
  if (!requireUserToken(token)) {
    res.status(401).json({ ok: false, error: 'You must be signed in to submit payment.' });
    return;
  }
  const newTrade = {
    id: trade.id || `p2p-tx-${Date.now()}`,
    offerId: trade.offerId,
    merchantName: trade.merchantName,
    type: trade.type || 'BUY',
    method: trade.method,
    fiatAmount: Number(trade.fiatAmount) || 0,
    currency: trade.currency || 'USD',
    xenaAmount: Number(trade.xenaAmount) || 0,
    pricePerXena: Number(trade.pricePerXena) || 2.85,
    buyerEmail: email,
    status: 'awaiting_validation',
    reference: trade.reference || `XN-${Math.floor(10000 + Math.random() * 90000)}-P2P`,
    time: 'Just now',
    submittedAt: Date.now(),
  };
  db.p2pTrades = [newTrade, ...(db.p2pTrades || [])];
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, trade: newTrade });
});

app.post('/api/p2p/payment/approve', (req, res) => {
  const { token, tradeId } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const trade = (db.p2pTrades || []).find((t) => t.id === tradeId);
  if (!trade) {
    res.status(404).json({ ok: false, error: 'Trade not found.' });
    return;
  }
  trade.status = 'approved';
  let credited = false;
  const buyer = (db.accounts || []).find((a) => a.email === trade.buyerEmail);
  if (buyer) {
    buyer.balances = buyer.balances || {};
    buyer.balances.availableXena = (buyer.balances.availableXena || 0) + trade.xenaAmount;
    buyer.balances.totalBalance = (buyer.balances.totalBalance || 0) + trade.xenaAmount;
    buyer.transactions = buyer.transactions || [];
    buyer.transactions.unshift({
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      title: `P2P Purchase (${trade.method})`,
      type: 'p2p_buy',
      amount: trade.xenaAmount,
      unit: 'XENA',
      status: 'Completed',
      timestamp: new Date().toLocaleString(),
      counterparty: trade.merchantName,
      paymentMethod: trade.method,
      fee: 0,
    });
    buyer.notifications = buyer.notifications || [];
    buyer.notifications.unshift({
      id: `notif-p2p-${Date.now()}`,
      title: 'P2P Payment Approved',
      message: `Admin validated your ${trade.method} payment. ${trade.xenaAmount} XENA has been released to your balance.`,
      timestamp: 'Just now',
      read: false,
      type: 'transaction',
    });
    credited = true;
  }
  saveDb();
  res.json({ ok: true, credited });
});

app.post('/api/p2p/payment/reject', (req, res) => {
  const { token, tradeId } = req.body || {};
  if (!requireAdminToken(token)) {
    res.status(401).json({ ok: false, error: 'Admin access required.' });
    return;
  }
  const trade = (db.p2pTrades || []).find((t) => t.id === tradeId);
  if (!trade) {
    res.status(404).json({ ok: false, error: 'Trade not found.' });
    return;
  }
  trade.status = 'rejected';
  saveDb();
  res.json({ ok: true });
});

// ---------- Payments: shared helpers (Flutterwave / NOWPayments) ----------
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '';
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || '';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '';
// Webhook URLs + redirect targets are built from this (set in .env / hosting).
const APP_ORIGIN = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

// Official XENA pricing: 1 XENA = N0.3333 = $0.0002564.
const NGN_PER_XENA = 0.3333;
const USD_PER_XENA = 0.0002564;
const MIN_NGN_DEPOSIT = 3000;
const MIN_USD_DEPOSIT = 10;

// Pending payments are tracked in db.pendingPayments so webhooks + client-side
// "confirm" calls share one idempotent credit path.
function pendingList() {
  db.pendingPayments = Array.isArray(db.pendingPayments) ? db.pendingPayments : [];
  return db.pendingPayments;
}

// Idempotently credit a confirmed payment row once. Mirrors the credit pattern
// used by /api/p2p/payment/approve (balance + transaction + notification).
function finalizeDeposit(pay, xena, opts = {}) {
  if (!pay) return false;
  if (pay.status === 'confirmed') return true;
  const acc = (db.accounts || []).find((a) => a.email === pay.email);
  if (!acc) return false;
  acc.balances = acc.balances || {};
  acc.balances.availableXena = (acc.balances.availableXena || 0) + xena;
  acc.balances.totalBalance = (acc.balances.totalBalance || 0) + xena;
  acc.transactions = acc.transactions || [];
  acc.transactions.unshift({
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    title: opts.title || 'Deposit',
    type: 'deposit',
    amount: xena,
    unit: 'XENA',
    status: 'Completed',
    timestamp: new Date().toLocaleString(),
    paymentMethod: opts.method || 'Payment',
    fee: 0,
  });
  acc.notifications = acc.notifications || [];
  acc.notifications.unshift({
    id: `notif-dep-${Date.now()}`,
    title: opts.notifTitle || 'Deposit Confirmed',
    message: opts.notifMessage || `${xena.toLocaleString()} XENA has been credited to your balance.`,
    timestamp: 'Just now',
    read: false,
    type: 'transaction',
  });
  pay.status = 'confirmed';
  pay.xena = xena;
  db.deposits = db.deposits || [];
  db.deposits.unshift({
    id: `dep-${Date.now()}`,
    user: acc.name || acc.email,
    email: pay.email,
    method: opts.method || pay.provider,
    amount: pay.amount,
    unit: pay.currency || 'USD',
    xena,
    status: 'Completed',
    time: 'Just now',
    reference: pay.reference,
  });
  saveDb();
  return true;
}

// ---------- Flutterwave (NGN deposits) ----------
app.post('/api/flutterwave/initialize', async (req, res) => {
  const { token, amountNgn } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const acc = (db.accounts || []).find((a) => a.email === email);
  if (!acc) {
    res.status(404).json({ ok: false, error: 'Account not found.' });
    return;
  }
  const amount = Math.round(Number(amountNgn) || 0);
  if (!(amount > 0)) {
    res.status(400).json({ ok: false, error: 'Enter a valid deposit amount.' });
    return;
  }
  if (amount < MIN_NGN_DEPOSIT) {
    res.status(400).json({ ok: false, error: `Minimum deposit is ₦${MIN_NGN_DEPOSIT.toLocaleString()}.` });
    return;
  }
  if (!FLUTTERWAVE_SECRET_KEY) {
    res.status(500).json({ ok: false, error: 'Flutterwave is not configured.' });
    return;
  }
  const txRef = 'xena-' + crypto.randomBytes(12).toString('hex');
  const payload = {
    tx_ref: txRef,
    amount,
    currency: 'NGN',
    redirect_url: `${APP_ORIGIN}/wallet?flutterwave_status=success`,
    payment_options: 'banktransfer,card,ussd',
    customer: { email, name: acc.name || 'XENA User' },
    customizations: { title: 'XENA Deposit', description: `Deposit ₦${amount.toLocaleString()} via Flutterwave`, logo: '' },
    meta: { email },
  };
  let fwData = {};
  try {
    const fw = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    fwData = await fw.json();
    if (!fw.ok || fwData?.status !== 'success') {
      res.status(502).json({ ok: false, error: fwData?.message || 'Unable to initialize Flutterwave payment.' });
      return;
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Unable to reach Flutterwave.' });
    return;
  }
  pendingList().unshift({
    id: `pp-${Date.now()}`,
    reference: txRef,
    provider: 'flutterwave',
    email,
    name: acc.name || '',
    amount,
    currency: 'NGN',
    status: 'pending',
    createdAt: new Date().toISOString(),
    meta: { tx_ref: txRef, payment_link: fwData.data?.link },
  });
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    reference: txRef,
    tx_ref: txRef,
    payment_link: fwData.data?.link,
    public_key: FLUTTERWAVE_PUBLIC_KEY,
  });
});

// Flutterwave webhook — set this URL in the Flutterwave dashboard. The
// verif-hash header must match FLUTTERWAVE_WEBHOOK_SECRET_HASH, and the
// transaction is re-verified server-side before any balance is credited.
app.post('/api/flutterwave/webhook', async (req, res) => {
  const signature = req.headers['verif-hash'] || req.headers['x-flutterwave-signature'] || '';
  if (FLUTTERWAVE_WEBHOOK_SECRET_HASH && signature !== FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
    res.status(401).json({ ok: false, error: 'Invalid signature.' });
    return;
  }
  const body = req.body || {};
  if (body.event !== 'charge.completed') {
    res.json({ ok: true });
    return;
  }
  const tx = body.data;
  if (!tx || tx.status !== 'successful' || tx.currency !== 'NGN') {
    res.json({ ok: true });
    return;
  }
  const pay = pendingList().find(
    (p) => p.provider === 'flutterwave' && (p.reference === tx.tx_ref || p.reference === String(tx.id || ''))
  );
  if (pay && pay.status === 'confirmed') {
    res.json({ ok: true });
    return;
  }
  let amount = Number(tx.amount || 0);
  let verified = false;
  if (FLUTTERWAVE_SECRET_KEY && tx.id) {
    try {
      const v = await fetch(`https://api.flutterwave.com/v3/transactions/${tx.id}/verify`, {
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
      });
      const vd = await v.json();
      if (vd?.status === 'success' && vd?.data?.status === 'successful') {
        amount = Number(vd.data.amount || amount);
        verified = true;
      }
    } catch (err) {
      verified = false;
    }
  }
  if (verified && pay) {
    const xena = Math.round((amount / NGN_PER_XENA) * 10000) / 10000;
    finalizeDeposit(pay, xena, {
      title: 'Naira Deposit (Flutterwave)',
      method: 'Flutterwave · NGN',
      notifTitle: 'Flutterwave Deposit Confirmed',
      notifMessage: `Your NGN deposit was verified. ${xena.toLocaleString()} XENA has been credited to your balance.`,
    });
  }
  res.json({ ok: true });
});

// Client-side confirm — called by "Confirm Payment" after the redirect back.
app.post('/api/flutterwave/verify', async (req, res) => {
  const { token, tx_ref } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const txRef = String(tx_ref || '').trim();
  if (!txRef) {
    res.status(400).json({ ok: false, error: 'Missing transaction reference.' });
    return;
  }
  const pay = pendingList().find((p) => p.provider === 'flutterwave' && p.reference === txRef && p.email === email);
  if (!pay) {
    res.status(404).json({ ok: false, error: 'Payment not found.' });
    return;
  }
  if (pay.status === 'confirmed') {
    res.json({ ok: true, xena: pay.xena || 0, duplicate: true });
    return;
  }
  if (!FLUTTERWAVE_SECRET_KEY) {
    res.status(500).json({ ok: false, error: 'Flutterwave is not configured.' });
    return;
  }
  let verifyData = {};
  try {
    const v = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
    });
    verifyData = await v.json();
    if (!v.ok || verifyData?.status !== 'success') {
      res.status(400).json({ ok: false, error: verifyData?.message || 'Payment not confirmed yet. Try again in a few seconds.' });
      return;
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Unable to reach Flutterwave.' });
    return;
  }
  const tx = verifyData.data;
  if (!tx || tx.status !== 'successful') {
    res.status(400).json({ ok: false, error: `Payment status: ${tx?.status || 'unknown'}` });
    return;
  }
  const amount = Number(tx.amount || pay.amount || 0);
  const xena = Math.round((amount / NGN_PER_XENA) * 10000) / 10000;
  finalizeDeposit(pay, xena, {
    title: 'Naira Deposit (Flutterwave)',
    method: 'Flutterwave · NGN',
    notifTitle: 'Flutterwave Deposit Confirmed',
    notifMessage: `Your NGN deposit was verified. ${xena.toLocaleString()} XENA has been credited to your balance.`,
  });
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, xena });
});

// ---------- NOWPayments (crypto deposits) ----------
const CRYPTO_CURRENCIES = { usdt: 'usdttrc20', usdc: 'usdctrc20', btc: 'btc', sol: 'sol', eth: 'eth' };

app.post('/api/crypto/create', async (req, res) => {
  const { token, coin, amountUsd } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const acc = (db.accounts || []).find((a) => a.email === email);
  if (!acc) {
    res.status(404).json({ ok: false, error: 'Account not found.' });
    return;
  }
  const coinKey = String(coin || '').toLowerCase();
  const payCurrency = CRYPTO_CURRENCIES[coinKey];
  if (!payCurrency) {
    res.status(400).json({ ok: false, error: 'Unsupported coin.' });
    return;
  }
  const usd = Number(amountUsd) || 0;
  if (!(usd > 0)) {
    res.status(400).json({ ok: false, error: 'Enter a valid USD amount.' });
    return;
  }
  if (usd < MIN_USD_DEPOSIT) {
    res.status(400).json({ ok: false, error: `Minimum deposit is $${MIN_USD_DEPOSIT}.` });
    return;
  }
  if (!NOWPAYMENTS_API_KEY) {
    res.status(500).json({ ok: false, error: 'NOWPayments is not configured.' });
    return;
  }
  let invoice = {};
  try {
    const inv = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: usd,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: `xena-${String(email).replace(/[^a-z0-9@._-]/gi, '')}-${Date.now()}`,
        order_description: `XENA deposit via ${coinKey.toUpperCase()}`,
        ipn_callback_url: `${APP_ORIGIN}/api/crypto/ipn`,
        success_url: `${APP_ORIGIN}/wallet`,
        cancel_url: `${APP_ORIGIN}/wallet`,
      }),
    });
    invoice = await inv.json();
    if (!inv.ok || !invoice?.id) {
      res.status(502).json({ ok: false, error: invoice?.message || 'NOWPayments rejected the invoice.' });
      return;
    }
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Unable to reach NOWPayments.' });
    return;
  }
  const reference = String(invoice.payment_id || invoice.id);
  pendingList().unshift({
    id: `pp-${Date.now()}`,
    reference,
    provider: 'nowpayments',
    email,
    name: acc.name || '',
    amount: usd,
    currency: 'USD',
    status: 'pending',
    createdAt: new Date().toISOString(),
    meta: { coin: coinKey, invoice_id: String(invoice.id) },
  });
  saveDb();
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    payment_id: reference,
    pay_address: invoice.pay_address || null,
    pay_amount: Number(invoice.pay_amount || usd),
    pay_currency: invoice.pay_currency || payCurrency,
    status: invoice.payment_status || 'waiting',
    invoice_url: invoice.invoice_url || null,
  });
});

// NOWPayments IPN webhook — set this URL as the IPN callback in NOWPayments.
// Signs the RAW body with HMAC-SHA512 (NOWPAYMENTS_IPN_SECRET) and credits
// only on confirmed/finished payments.
app.post('/api/crypto/ipn', async (req, res) => {
  const signature = req.headers['x-nowpayments-sig'] || '';
  if (!NOWPAYMENTS_IPN_SECRET || !signature) {
    res.status(401).json({ ok: false, error: 'Missing signature.' });
    return;
  }
  const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET).update(raw).digest('hex');
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ ok: false, error: 'Invalid signature.' });
    return;
  }
  const parsed = req.body || {};
  const paymentId = String(parsed.payment_id || parsed.id || '');
  if (!paymentId) return res.json({ ok: true });
  const status = String(parsed.payment_status || parsed.status || '');
  if (!['confirmed', 'finished'].includes(status)) return res.json({ ok: true });
  const pay = pendingList().find((p) => p.provider === 'nowpayments' && p.reference === paymentId);
  if (!pay) return res.json({ ok: true });
  if (pay.status === 'confirmed') return res.json({ ok: true });
  const amount = Number(parsed.fiat_amount || parsed.price_amount || pay.amount || 0);
  const xena = Math.round((amount / USD_PER_XENA) * 10000) / 10000;
  const coinLabel = String(pay.meta?.coin || '').toUpperCase() || 'Crypto';
  finalizeDeposit(pay, xena, {
    title: 'Crypto Deposit (NOWPayments)',
    method: `NOWPayments · ${coinLabel}`,
    notifTitle: 'Crypto Deposit Confirmed',
    notifMessage: `Your ${coinLabel} payment was confirmed. ${xena.toLocaleString()} XENA has been credited to your balance.`,
  });
  res.json({ ok: true });
});

// Client-side poll — called by "Check Payment Status" in the deposit modal.
app.post('/api/crypto/status', async (req, res) => {
  const { token, payment_id } = req.body || {};
  const email = emailForToken(token);
  if (!email) {
    res.status(401).json({ ok: false, error: 'Session invalid. Please sign in again.' });
    return;
  }
  const paymentId = String(payment_id || '').trim();
  if (!paymentId) {
    res.status(400).json({ ok: false, error: 'Missing payment id.' });
    return;
  }
  const pay = pendingList().find((p) => p.provider === 'nowpayments' && p.reference === paymentId && p.email === email);
  if (!pay) {
    res.status(404).json({ ok: false, error: 'Payment not found.' });
    return;
  }
  if (pay.status === 'confirmed') {
    res.json({ ok: true, status: 'confirmed', xena: pay.xena || 0, duplicate: true });
    return;
  }
  if (!NOWPAYMENTS_API_KEY) {
    res.status(500).json({ ok: false, error: 'NOWPayments is not configured.' });
    return;
  }
  let data = {};
  try {
    const sres = await fetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
      headers: { 'x-api-key': NOWPAYMENTS_API_KEY },
    });
    data = await sres.json();
  } catch (err) {
    res.status(502).json({ ok: false, error: 'Unable to reach NOWPayments.' });
    return;
  }
  const status = String(data.payment_status || pay.status || 'waiting');
  if (!['confirmed', 'finished'].includes(status)) {
    res.json({ ok: true, status });
    return;
  }
  const amount = Number(data.fiat_amount || data.price_amount || pay.amount || 0);
  const xena = Math.round((amount / USD_PER_XENA) * 10000) / 10000;
  const coinLabel = String(pay.meta?.coin || '').toUpperCase() || 'Crypto';
  finalizeDeposit(pay, xena, {
    title: 'Crypto Deposit (NOWPayments)',
    method: `NOWPayments · ${coinLabel}`,
    notifTitle: 'Crypto Deposit Confirmed',
    notifMessage: `Your ${coinLabel} payment was confirmed. ${xena.toLocaleString()} XENA has been credited to your balance.`,
  });
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, status: 'confirmed', xena });
});

const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(INDEX_HTML, (err) => {
      if (err) res.status(404).end();
    });
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send('XENA Exchange API is running. Build the client with `npm run build` first.');
  });
}

app.listen(PORT);