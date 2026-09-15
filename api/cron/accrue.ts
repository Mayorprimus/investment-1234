import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, json, handleError } from '../_lib/helpers.js';

// Daily investment accrual trigger, invoked by Vercel Cron. Idempotent: the
// SQL function only ticks days not yet accrued for active investments.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const sb = await getServiceClient();
    const { data, error } = await sb.rpc('accrue_investments', { p_days: 1 });
    if (error) return json(res, { ok: false, error: error.message }, 502);
    return json(res, { ok: true, touched: data });
  } catch (e) {
    return handleError(e, res);
  }
}