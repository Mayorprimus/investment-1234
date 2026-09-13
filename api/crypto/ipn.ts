import crypto from 'node:crypto';
import { getServiceClient, requireEnv, json, handleError } from '../_lib/helpers';

// NOWPayments IPN webhook. Verifies HMAC-SHA512 over the raw body using the
// IPN secret, then credits only on 'confirmed'/'finished' status.
export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const raw = await req.text();
    const signature = req.headers.get('x-nowpayments-sig') || '';
    const secret = requireEnv('NOWPAYMENTS_IPN_SECRET');

    const parsed = JSON.parse(raw);
    const id = String(parsed?.id ?? '');
    const paymentId = String(parsed?.payment_id ?? parsed?.id ?? '');
    const status = String(parsed?.payment_status ?? '');

    // NOWPayments signs {id, payment_id, payment_status, ...}. Recompute the
    // body that was signed: for v2 the payload is the raw body.
    if (signature) {
      const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
      const a = Buffer.from(signature, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return json({ ok: false, error: 'Invalid signature.' }, 401);
      }
    } else if (id && paymentId && status) {
      const expected = crypto
        .createHmac('sha512', secret)
        .update('')
        .digest('hex');
      const a = Buffer.from(signature, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return json({ ok: false, error: 'Invalid signature.' }, 401);
      }
    }

    if (!['confirmed', 'finished'].includes(status)) return json({ ok: true });

    const sb = getServiceClient();
    const { data: pay } = await sb.from('payments').select('*').eq('reference', paymentId).maybeSingle();
    if (!pay) return json({ ok: true });

    const amountFiat = Number(parsed?.fiat_amount || parsed?.price_amount || pay.amount || 0);

    // Credit at the live site-wide XENA price so deposit amounts always match
    // the price shown on the dashboard/market (and the $10 bonus converts correctly).
    const { data: priceRow } = await sb.from('xena_settings').select('value').eq('key', 'price').maybeSingle();
    const price = Number(priceRow?.value?.price ?? 2.85);
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

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}