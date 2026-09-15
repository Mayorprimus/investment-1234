import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireEnv, json, readJsonBody, handleError } from '../_lib/helpers.js';

// Client-side poll: checks a NOWPayments payment status and credits once.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const paymentId = String(body?.payment_id || body?.reference || '').trim();
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!paymentId) return json(res, { ok: false, error: 'Missing payment_id.' }, 400);

    const sb = await getServiceClient();
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    const { data: pay } = await sb.from('payments').select('*').eq('reference', paymentId).maybeSingle();
    if (!pay) return json(res, { ok: false, error: 'Payment not found.' }, 404);
    if (pay.email?.toLowerCase() !== String(u.user.email || '').toLowerCase()) {
      return json(res, { ok: false, error: 'This payment belongs to another account.' }, 403);
    }

    if (pay.status === 'confirmed' || pay.status === 'finished') {
      return json(res, { ok: true, status: pay.status, xena: Number(pay.xena || 0) });
    }

    const apiKey = requireEnv('NOWPAYMENTS_API_KEY');
    const resStatus = await fetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    const data = await resStatus.json();
    const status = String(data?.payment_status || pay.status || 'waiting');

    if (!['confirmed', 'finished'].includes(status)) {
      return json(res, { ok: false, status, error: `Payment status: ${status}` });
    }

    const amountFiat = Number(data?.fiat_amount || data?.price_amount || pay.amount || 0);
    const { data: priceRow } = await sb.from('xena_settings').select('value').eq('key', 'price').maybeSingle();
    const price = Number(priceRow?.value?.price ?? 0.0002564);
    const xena = Math.round((amountFiat / price) * 10000) / 10000;

    const { data: credit, error: creditErr } = await sb.rpc('credit_payment', {
      p_reference: paymentId,
      p_provider: 'nowpayments',
      p_amount: amountFiat,
      p_currency: 'USD',
      p_xena: xena,
      p_email: pay.email,
      p_meta: pay.meta || null,
    });
    if (creditErr) return json(res, { ok: false, error: creditErr.message }, 502);

    return json(res, { ok: true, status, xena: Number(credit?.xena ?? xena), duplicate: !!credit?.duplicate });
  } catch (e) {
    return handleError(e, res);
  }
}