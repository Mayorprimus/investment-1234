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
  const sb = requireSupabase();
  const { data: tokenRow } = await sb.from('tokens').select('email').eq('token', token).maybeSingle();
  if (!tokenRow?.email) return null;
  const { data: account } = await sb.from('accounts').select('*').eq('email', tokenRow.email).maybeSingle();
  return account || null;
}

export async function getSetting(key: string): Promise<any> {
  const sb = requireSupabase();
  const { data } = await sb.from('xena_settings').select('value').eq('key', key).maybeSingle();
  return data?.value || null;
}

export async function savePendingPayment(payment: any): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('pending_payments').insert(payment);
  if (error) throw error;
}

export async function findPendingPayment(provider: string, reference: string): Promise<any | null> {
  const sb = requireSupabase();
  const { data } = await sb.from('pending_payments').select('*').eq('provider', provider).eq('reference', reference).maybeSingle();
  return data || null;
}

export async function findPendingPaymentByEmail(provider: string, email: string): Promise<any | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from('pending_payments')
    .select('*')
    .eq('provider', provider)
    .eq('email', email)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

export async function updatePendingPayment(reference: string, updates: any): Promise<any | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('pending_payments').update(updates).eq('reference', reference).select().maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function creditUser(email: string, xenaAmount: number, txData: any): Promise<boolean> {
  const sb = requireSupabase();
  const { data: account } = await sb.from('accounts').select('*').eq('email', email).maybeSingle();
  if (!account) return false;

  const newAvailableXena = (account.balances?.availableXena || 0) + xenaAmount;
  const newTotalBalance = (account.balances?.totalBalance || 0) + xenaAmount;

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

  const { error: updateError } = await sb.from('accounts').update({
    balances: {
      ...account.balances,
      availableXena: newAvailableXena,
      totalBalance: newTotalBalance,
    },
    transactions: [newTx, ...(account.transactions || [])],
    notifications: [newNotification, ...(account.notifications || [])],
  }).eq('email', email);

  if (updateError) throw updateError;

  // Also insert into deposits table for record-keeping
  const depositRecord = {
    id: `dep-${Date.now()}`,
    email,
    amount: txData.amount || 0,
    unit: txData.unit || 'XENA',
    xena: xenaAmount,
    status: 'Completed',
    method: txData.method || 'Deposit',
    reference: txData.reference,
    created_at: new Date().toISOString(),
  };
  await sb.from('deposits').insert(depositRecord);

  return true;
}