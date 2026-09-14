import { getServiceClient, json, handleError } from '../_lib/helpers';

// Daily investment accrual trigger, invoked by Vercel Cron. Idempotent: the
// SQL function only ticks days not yet accrued for active investments.
export default async function handler(_req: Request) {
  try {
    const sb = await getServiceClient();
    const { data, error } = await sb.rpc('accrue_investments', { p_days: 1 });
    if (error) return json({ ok: false, error: error.message }, 502);
    return json({ ok: true, touched: data });
  } catch (e) {
    return handleError(e);
  }
}