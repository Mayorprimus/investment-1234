import { getServiceClient, requireEnv, json, readJsonBody, handleError } from '../_lib/helpers';

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const txRef = String(body?.tx_ref || body?.reference || '').trim();
    if (!token) return json({ ok: false, error: 'Not authenticated.' }, 401);
    if (!txRef) return json({ ok: false, error: 'Missing tx_ref/reference.' }, 400);

    const sb = getServiceClient();
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return json({ ok: false, error: 'Invalid session.' }, 401);

    const secret = requireEnv('FLUTTERWAVE_SECRET_KEY');
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || verifyData?.status !== 'success') {
      return json({ ok: false, error: verifyData?.message || 'Payment not confirmed.' }, 400);
    }

    const tx = verifyData.data;
    if (tx.status !== 'successful') {
      return json({ ok: false, error: `Payment status: ${tx.status}` }, 400);
    }
    if (tx.currency !== 'NGN') {
      return json({ ok: false, error: 'Unexpected currency.' }, 400);
    }

    const amountNgn = Number(tx.amount || 0);
    const { data: rateRow } = await sb.from('xena_settings').select('value').eq('key', 'xena_ngn_rate').maybeSingle();
    const { data: limits } = await sb.from('xena_settings').select('value').eq('key', 'limits').maybeSingle();
    const rate = Number(rateRow?.value?.ngnRate ?? limits?.value?.xenaNgnRate ?? 1500);
    const xenaAmount = Math.round((amountNgn / rate) * 10000) / 10000;

    const { data, error } = await sb.rpc('credit_payment', {
      p_reference: `flutterwave-${tx.id}`,
      p_provider: 'flutterwave',
      p_amount: amountNgn,
      p_currency: 'NGN',
      p_email: u.user.email,
      p_xena: xenaAmount,
      p_meta: { coin: 'ngn', method: 'flutterwave' },
    });
    if (error) throw error;

    return json({ ok: true, xena: xenaAmount });
  } catch (e) {
    return handleError(e);
  }
}