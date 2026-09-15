import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseModule: typeof import('@supabase/supabase-js') | null = null;

async function loadSupabase() {
  if (!supabaseModule) {
    supabaseModule = await import('@supabase/supabase-js');
  }
  return supabaseModule;
}

export async function getServiceClient(): Promise<SupabaseClient> {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  const { createClient } = await loadSupabase();
  return createClient(url, key, { auth: { persistSession: false }, db: { schema: 'public' } });
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

export async function requireAdminToken(req: VercelRequest, body: any): Promise<boolean> {
  const token = String(body?.token || '');
  if (!token) return false;
  const sb = await getServiceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  return !!profile && profile.role === 'admin';
}