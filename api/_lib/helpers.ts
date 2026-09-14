type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;

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

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function readJsonBody(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body.');
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function handleError(e: unknown): Response {
  return json({ ok: false, error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
}

export async function requireAdminToken(req: Request, body: any): Promise<boolean> {
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