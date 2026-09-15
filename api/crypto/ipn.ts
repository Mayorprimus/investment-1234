import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, requireEnv, readRawBody, json, handleError } from '../_lib/helpers.js';

// NOWPayments IPN webhook. Verifies HMAC-SHA512 over the raw body using the
// IPN secret, then credits only on 'confirmed'/'finished' status.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const raw = await readRawBody(req);
    const signature = req.headers['x-nowpayments-sig'] || '';
    const secret = requireEnv('NOWPAYMENTS_IPN_SECRET');

    if (!signature) return json(res, { ok: false, error: 'Missing signature.' }, 401);

    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return json(res, { ok: false, error: 'Invalid signature.' }, 401);
    }

    const parsed = JSON.parse(raw);
    const paymentId = String(parsed?.payment_id || parsed?.id || '');
    const status = String(parsed?.payment_status || parsed?.status || '');
    if (!paymentId) return json(res, { ok: true });

    if (!['confirmed', 'finished'].includes(status)) return json(res, { ok: true });

    const sb = await getServiceClient();
    const { data: pay } = await sb.from('payments').select('*').eq('reference', paymentId).maybeSingle();
    if (!pay) return json(res, { ok: true });

    const amountFiat = Number(parsed?.fiat_amount || parsed?.price_amount || pay.amount || 0);

    const { data: priceRow } = await sb.from('xena_settings').select('value').eq('key', 'price').maybeSingle();
    const price = Number(priceRow?.value?.price ?? 0.0002564);
    const xena = Math.round((amountFiat / price) * 10000) / 10000;

    await sb.rpc('credit_payment', {
      p_reference: paymentId,
      p_provider: pay.provider || 'nowpayments',
      p_amount: amountFiat,
      p_currency: pay.currency || 'USD',
      p_xena: xena,
      p_email: pay.email,
      p_meta: pay.meta || null,
    });

    return json(res, { ok: true });
  } catch (e) {
    return handleError(e, res);
  }
}