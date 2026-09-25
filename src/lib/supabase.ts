import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Account,
  Announcement,
  InvestmentPlan,
  NotificationItem,
  P2POffer,
  P2PTrade,
  StoreUser,
  StoreUserBalances,
  Transaction,
  UserBalances,
} from '../types';

const FALLBACK_URL = 'https://sosjovwelbtarzvptybh.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_rA12HvuwDIftGM-vh-bTtg_umO3VGCu';

// Env vars are inlined by Vite at BUILD time. A malformed value (http://,
// surrounding quotes, stray whitespace/newlines, or a trailing slash) is the
// most common cause of a production-only "Failed to fetch" on auth calls, so
// normalize defensively before handing the value to supabase-js.
function normalizeUrl(raw: string | undefined): string {
  let v = (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!v) return '';
  if (v.startsWith('http://')) v = 'https://' + v.slice('http://'.length); // avoid mixed-content block
  else if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  v = v.replace(/\/+$/, ''); // supabase-js expects no trailing slash
  try {
    return new URL(v).origin;
  } catch {
    return '';
  }
}

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const rawAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const normalizedUrl = normalizeUrl(rawUrl);
const anonKey = (rawAnonKey ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();

export const supabaseUrl = normalizedUrl || FALLBACK_URL;
const resolvedAnonKey = anonKey || FALLBACK_ANON_KEY;
export const usingFallbackSupabase = supabaseUrl === FALLBACK_URL && resolvedAnonKey === FALLBACK_ANON_KEY;

if (rawUrl && !normalizedUrl) {
  console.error('[v0] VITE_SUPABASE_URL is set but not a valid URL. Falling back to default project. Check the value in your Vercel project settings (it must be like https://xxxx.supabase.co).');
} else if (!rawUrl) {
  console.warn('[v0] VITE_SUPABASE_URL is not set at build time; using the built-in fallback Supabase project.');
} else if (!anonKey) {
  console.error('[v0] VITE_SUPABASE_ANON_KEY is missing while VITE_SUPABASE_URL is set. Auth requests will fail — set both in Vercel and redeploy.');
}
console.log('[v0] Supabase configured for host:', (() => { try { return new URL(supabaseUrl).host; } catch { return '(invalid)'; } })());

export const sb: SupabaseClient = createClient(supabaseUrl, resolvedAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// supabase-js throws a bare TypeError "Failed to fetch" when the browser can't
// reach the project at all (wrong/typo host, paused project, mixed content,
// blocked by an extension). Translate that into something actionable.
export function describeAuthError(err: unknown): string {
  const msg = (err as any)?.message ? String((err as any).message) : String(err ?? '');
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    let host = '';
    try { host = new URL(supabaseUrl).host; } catch {}
    return `Can't reach the authentication server${host ? ` (${host})` : ''}. Check your internet connection and that the Supabase project is active and its URL is correct.`;
  }
  return msg || 'Network error. Please try again.';
}
export const XENA_NGN_RATE = 0.266;

export const DEFAULT_PRICE = 0.0002;

export async function getSessionToken(): Promise<string | null> {
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

// ---------- DB row → client shape mappers (snake_case → camelCase) ----------

export function mapBalances(b: any): UserBalances {
  // Total balance = spendable (available) balance. Storing the sum with
  // investedXena was wrong: buying a plan moves XENA from available to
  // invested, so the Total card must drop to the new available figure.
  const availableXena = Number(b?.availableXena || 0);
  const investedXena = Number(b?.investedXena || 0);
  return {
    totalXena: availableXena,
    totalBalance: availableXena,
    usdRate: Number(b?.usdRate || DEFAULT_PRICE),
    change24hAmount: Number(b?.change24hAmount || 0),
    change24hPercent: Number(b?.change24hPercent || 0),
    availableXena,
    investedXena,
    averageBuyPrice: Number(b?.averageBuyPrice || 0),
    currentPrice: Number(b?.currentPrice || DEFAULT_PRICE),
    stakedXena: Number(b?.stakedXena || 0),
    lockedInOrders: Number(b?.lockedInOrders || 0),
    nairaBalance: Number(b?.nairaBalance || 0),
    xenaNgnRate: Number(b?.xenaNgnRate || XENA_NGN_RATE),
  };
}

export function mapTransactions(txs: any[]): Transaction[] {
  return Array.isArray(txs) ? (txs as Transaction[]) : [];
}

export function mapNotifications(ns: any[]): NotificationItem[] {
  return Array.isArray(ns) ? (ns as NotificationItem[]) : [];
}

export function mapInvestment(i: any): InvestmentPlan {
  const status = String(i?.status || 'active');
  return {
    id: i.id,
    name: i.plan_name || i.planName || 'Vault',
    category: i.category || 'Flexible',
    investedAmount: Number(i.invested_xena || i.investedXena || 0),
    projectedReturnPercent: Number(i.apy ?? i.projectedReturnPercent ?? 0),
    earnedAmount: Number(i.earned_xena || i.earnedAmount || 0),
    progressPercent: Number(i.progress_percent ?? i.progressPercent ?? 0),
    daysRemaining: Number(i.days_remaining ?? i.daysRemaining ?? 0),
    totalDays: Number(i.total_days ?? i.totalDays ?? 0),
    startDate: i.started_at || i.startDate,
    endDate: i.ended_at || i.endDate,
    status: status === 'canceled' ? 'Pending' : status === 'matured' ? 'Matured' : 'Active',
    dailyYieldXena: Number(i.dailyYieldXena || 0),
  };
}

export function mapVault(v: any) {
  return {
    id: v.id,
    name: v.name,
    category: v.category || 'Flexible',
    apy: Number(v.apy || 0),
    duration: v.duration || 'Flexible',
    days: Number(v.days || 0),
    minDeposit: Number(v.min_deposit ?? v.minDeposit ?? 1),
    badge: v.badge || '',
    risk: v.risk || 'Low Risk',
    description: v.description || '',
    active: v.active !== false,
    sortOrder: Number(v.sort_order || v.sortOrder || 0),
  };
}

export function mapOffer(o: any): P2POffer {
  return {
    id: o.id,
    merchantName: o.merchant_name || o.merchantName || '',
    merchantTier: o.merchant_tier || o.merchantTier || 'Verified Trader',
    completionRate: Number(o.completion_rate ?? o.completionRate ?? 100),
    completedOrders: Number(o.completed_orders ?? o.completedOrders ?? 0),
    ordersCount: Number(o.orders_count ?? o.ordersCount ?? 0),
    type: o.type,
    pricePerXena: Number(o.price_per_xena ?? o.pricePerXena ?? DEFAULT_PRICE),
    currency: o.currency || 'USD',
    minLimit: Number(o.min_limit ?? o.minLimit ?? 50),
    maxLimit: Number(o.max_limit ?? o.maxLimit ?? 2500),
    availableXena: Number(o.available_xena ?? o.availableXena ?? 1000),
    paymentMethods: o.payment_methods || o.paymentMethods || ['Bank Transfer'],
    paymentMethod: o.payment_method || o.paymentMethod || 'Bank Transfer',
    responseTimeMinutes: Number(o.response_time_minutes ?? o.responseTimeMinutes ?? 2),
    isOnline: o.is_online !== false,
    status: o.status || 'pending',
    listedBy: o.listed_by || o.listedBy || '',
    listedEmail: o.listed_email || o.listedEmail || '',
    sortOrder: Number(o.sort_order ?? o.sortOrder ?? 1000),
    listedAt: o.listed_at ? Number(o.listed_at) : undefined,
  };
}

export function mapTrade(t: any): P2PTrade {
  return {
    id: t.id,
    offerId: t.offer_id || t.offerId || '',
    merchantName: t.merchant_name || t.merchantName || '',
    type: t.type || 'BUY',
    method: t.method || '',
    fiatAmount: Number(t.fiat_amount ?? t.fiatAmount ?? 0),
    currency: t.currency || 'USD',
    xenaAmount: Number(t.xena_amount ?? t.xenaAmount ?? 0),
    pricePerXena: Number(t.price_per_xena ?? t.pricePerXena ?? DEFAULT_PRICE),
    buyerEmail: t.buyer_email || t.buyerEmail || '',
    status: t.status || 'awaiting_validation',
    reference: t.reference || '',
    time: t.time || 'Just now',
  };
}

export function mapAnnouncement(a: any): Announcement {
  return {
    id: a.id,
    title: a.title,
    date: a.date,
    tag: a.tag || 'News',
    tagColor: a.tag_color || a.tagColor || 'bg-emerald-50 text-[#16A34A] border-emerald-100',
    summary: a.summary,
    actionText: a.action_text || a.actionText,
    actionId: a.action_id || a.actionId,
    publishedBy: a.published_by || a.publishedBy,
  };
}

export function mapInvestmentPlanRow(i: any): InvestmentPlan {
  return mapInvestment(i);
}

export function mapProfileToStoreUser(p: any): StoreUser {
  return {
    id: p.id,
    name: p.name || '',
    email: p.email,
    xenaId: p.xena_id || '',
    xenaCode: p.xena_code || '',
    kycTier: p.kyc_tier || 'Tier 1 (Pending)',
    joined: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : '',
    status: p.status === 'frozen' ? 'frozen' : 'active',
    twoFactorEnabled: !!p.two_factor_enabled,
    pinSet: !!p.pin_set,
    balances: {
      availableXena: Number(p.balances?.availableXena || 0),
      nairaBalance: Number(p.balances?.nairaBalance || 0),
      investedXena: Number(p.balances?.investedXena || 0),
    } as StoreUserBalances,
  };
}

export function mapProfileToAccount(p: any, investmentsForUser: InvestmentPlan[] = []): Account {
  const created = p.created_at ? new Date(p.created_at) : new Date();
  return {
    id: p.id,
    name: p.name || '',
    email: p.email,
    password: '',
    country: p.country || 'Nigeria',
    phone: p.phone || '',
    dob: p.dob || '',
    referrer: p.referrer || '',
    xenaId: p.xena_id || '',
    xenaCode: p.xena_code || '',
    kycTier: p.kyc_tier || 'Tier 1 (Pending)',
    status: p.status || 'active',
    joined: created.toISOString().slice(0, 10),
    twoFactorEnabled: !!p.two_factor_enabled,
    pinSet: !!p.pin_set,
    verifiedAccountsCount: Number(p.verified_accounts_count || 0),
    balances: mapBalances(p.balances),
    transactions: mapTransactions(p.transactions),
    investments: investmentsForUser,
    notifications: mapNotifications(p.notifications),
    redeemedBonusCodes: Array.isArray(p.redeemed_bonus_codes) ? (p.redeemed_bonus_codes as string[]) : [],
    bankDetails: Array.isArray(p.bank_details) ? (p.bank_details as any[]) : [],
    walletAddresses: Array.isArray(p.wallet_addresses) ? (p.wallet_addresses as any[]) : [],
  };
}

export function mapPublicState(raw: any) {
  return {
    xenaPrice: Number(raw?.xenaPrice ?? DEFAULT_PRICE),
    xenaNgnRate: Number(raw?.xenaNgnRate ?? XENA_NGN_RATE),
    limits: raw?.limits || { min_deposit_ngn: 3000, min_withdrawal_ngn: 3000 },
    settings: raw?.settings || { maintenanceMode: false, p2pZeroFee: true, withdrawApproval: true },
    escrow: raw?.escrow || {},
    announcements: (raw?.announcements || []).map(mapAnnouncement),
    vaultCatalog: (raw?.vaultCatalog || []).map(mapVault),
    p2pOffers: (raw?.p2pOffers || []).map(mapOffer),
  };
}

export async function callRpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(name as any, args as any);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function getSessionUser() {
  const { data } = await sb.auth.getSession();
  return data?.session?.user ?? null;
}

export async function currentProfile() {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data ?? null;
}

export async function isAdminNow(): Promise<boolean> {
  const data = await callRpc<any>('is_admin');
  return !!data;
}
