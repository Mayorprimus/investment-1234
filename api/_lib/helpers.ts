import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sosjovwelbtarzvptybh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvc2pvdndlbGJ0YXJ6dnB0eWJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODgyNDAxNywiZXhwIjoyMTA0NDAwMDE3fQ.Gv6itjGih9pdqi0n4YYlfr07jHnnAXJbxFewu8alQDU';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
  return supabase;
}

// Supabase admin client (service role) — for auth admin operations
export async function getServiceClient() {
  return requireSupabase();
}

// Admin token check — supports both old (token only) and new (req, body) signatures
export async function requireAdminToken(tokenOrReq: any, body?: any): Promise<boolean> {
  const token = typeof tokenOrReq === 'string' ? tokenOrReq : (tokenOrReq?.body?.token || '');
  if (!token) return false;
  const sb = requireSupabase();
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return false;
  const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return !!profile && profile.role === 'admin';
}

export function getAppUrl(): string {
  return (process.env.APP_URL || '').replace(/\/$/, '');
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

export async function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      try {
        resolve(JSON.stringify(req.body));
      } catch {
        reject(new Error('Invalid body.'));
      }
      return;
    }
    let data = '';
    req.on('data', (c: Buffer) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function json(res: VercelResponse, data: unknown, status = 200): void {
  res.status(status).json(data);
}

export function handleError(e: unknown, res: VercelResponse): void {
  json(res, { ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
}

// ---- Supabase-backed helpers ----

export async function getUserByToken(token: string): Promise<any | null> {
  if (!token) return null;
  try {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function getSetting(key: string): Promise<any> {
  const sb = requireSupabase();
  const { data } = await sb.from('xena_settings').select('value').eq('key', key).maybeSingle();
  return data?.value || null;
}

export async function savePendingPayment(payment: any): Promise<void> {
  const sb = requireSupabase();
  const row = {
    provider: payment.provider,
    reference: payment.reference,
    email: String(payment.email || '').toLowerCase(),
    amount: Number(payment.amount || 0),
    currency: payment.currency || payment.unit || 'USD',
    xena: Number(payment.xena || 0),
    status: payment.status || 'pending',
    user_id: payment.user_id || null,
    meta: payment.meta || {},
  };
  const { error } = await sb.from('payments').upsert(row, { onConflict: 'reference' });
  if (error) throw error;
}

export async function findPendingPayment(provider: string, reference: string): Promise<any | null> {
  const sb = requireSupabase();
  const { data } = await sb.from('payments').select('*').eq('provider', provider).eq('reference', reference).maybeSingle();
  return data || null;
}

export async function findPendingPaymentByEmail(provider: string, email: string): Promise<any | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from('payments')
    .select('*')
    .eq('provider', provider)
    .eq('email', String(email || '').toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function updatePendingPayment(reference: string, updates: any): Promise<any | null> {
  const sb = requireSupabase();
  const patch: Record<string, unknown> = {};
  if (updates.status != null) patch.status = updates.status;
  if (updates.xena != null) patch.xena = Number(updates.xena);
  if (updates.amount != null) patch.amount = Number(updates.amount);
  if (updates.email != null) patch.email = String(updates.email).toLowerCase();
  if (updates.meta != null) patch.meta = updates.meta;
  if (updates.status === 'confirmed' || updates.status === 'completed') {
    patch.confirmed_at = new Date().toISOString();
  } else {
    patch.updated_at = new Date().toISOString();
  }
  const { data, error } = await sb.from('payments').update(patch).eq('reference', reference).select().maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function creditUser(email: string, xenaAmount: number, txData: any): Promise<boolean> {
  const sb = requireSupabase();
  const lowerEmail = String(email || '').toLowerCase();
  const { data: profile } = await sb.from('profiles').select('*').eq('email', lowerEmail).maybeSingle();
  if (!profile) return false;

  const newAvailableXena = (profile.balances?.availableXena || 0) + xenaAmount;
  const newTotalBalance = (profile.balances?.totalBalance || 0) + xenaAmount;

  const newTx = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 999)}`,
    ...txData,
    amount: xenaAmount,
    unit: 'XENA',
    status: 'Completed',
    timestamp: new Date().toLocaleString(),
    fee: 0,
  };

  const newNotification = {
    id: `notif-dep-${Date.now()}`,
    title: txData.notifTitle || 'Deposit Confirmed',
    message: txData.notifMessage || `${xenaAmount.toLocaleString()} XENA credited.`,
    timestamp: 'Just now',
    read: false,
    type: 'transaction',
  };

  const { error: updateError } = await sb.from('profiles').update({
    balances: {
      ...profile.balances,
      availableXena: newAvailableXena,
      totalBalance: newTotalBalance,
    },
    transactions: [newTx, ...(profile.transactions || [])],
    notifications: [newNotification, ...(profile.notifications || [])],
  }).eq('email', lowerEmail);

  if (updateError) throw updateError;
  return true;
}

// ---- Admin dashboard blob (admin_state.deposits) helpers ----
// The admin portal draws its Deposit Ledger from admin_state.blob.deposits,
// so keep online payments mirrored there (id = payments.id).

export async function getAdminBlob(): Promise<any> {
  const sb = requireSupabase();
  const { data } = await sb.from('admin_state').select('blob').eq('id', 1).maybeSingle();
  return data?.blob || {};
}

export async function setAdminBlob(blob: any): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('admin_state').upsert({ id: 1, blob, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function appendBlobDeposit(entry: any): Promise<void> {
  const blob = await getAdminBlob();
  const deposits = Array.isArray(blob.deposits) ? blob.deposits : [];
  const exists = deposits.some((d: any) => d.id === entry.id || (entry.reference && d.reference === entry.reference));
  if (!exists) {
    deposits.push(entry);
    await setAdminBlob({ ...blob, deposits });
  }
}

export async function updateBlobDeposit(matchId: string, patch: any): Promise<void> {
  const blob = await getAdminBlob();
  const deposits = Array.isArray(blob.deposits) ? blob.deposits : [];
  const next = deposits.map((d: any) => (d.id === matchId ? { ...d, ...patch } : d));
  await setAdminBlob({ ...blob, deposits: next });
}

// Referral reward calculation - $0.38 worth of XENA
export async function calculateReferralReward(sb: any): Promise<number> {
  const { data } = await sb.from('xena_settings').select('value').eq('key', 'price').maybeSingle();
  const price = Number(data?.value?.price ?? 0.0002);
  return Math.round(0.38 / price); // 1,900 at $0.0002
}