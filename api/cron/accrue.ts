import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, handleError, requireSupabase } from '../_lib/helpers.js';

// Daily yield tick. Triggered by the Vercel cron in vercel.json (and callable
// manually for testing). Verifies the CRON_SECRET Authorization header when set;
// the underlying accrual is additionally idempotent via the 23h guard in SQL.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = String(req.headers.authorization || '');
      const expected = `Bearer ${secret}`;
      if (auth !== expected) {
        return json(res, { ok: false, error: 'Unauthorized.' }, 401);
      }
    }

    if (req.method !== 'GET' && req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);

    const sb = requireSupabase();
    const { data, error } = await sb.rpc('accrue_investments');
    if (error) throw error;
    const processed = Number((data as any)?.processed || 0);
    return json(res, { ok: true, processed, at: new Date().toISOString() });
  } catch (e) {
    return handleError(e, res);
  }
}