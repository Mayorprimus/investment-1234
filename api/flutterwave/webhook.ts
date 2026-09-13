import crypto from 'node:crypto';
import { getServiceClient, requireEnv, json, readJsonBody, handleError } from '../_lib/helpers';

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: true }, 200);
    const body = await readJsonBody(req);
    const signature = req.headers.get('verif-hash') || req.headers.get('x-flutterwave-signature') || '';
    const secretHash = requireEnv('FLUTTERWAVE_WEBHOOK_SECRET_HASH');

    if (secretHash && signature !== secretHash) {
      console.warn('Flutterwave webhook: invalid signature');
      return json({ ok: true }, 200);
    }

    const event = body?.event;
    if (event !== 'charge.completed') return json({ ok: true }, 200);

    const tx = body?.data;
    if (!tx || tx.status !== 'successful' || tx.currency !== 'NGN') return json({ ok: true }, 200);

    const reference = `flutterwave-${tx.id}`;
    const amountNgn = Number(tx.amount || 0);
    const email = String(tx.customer?.email || '').trim().toLowerCase();

    const sb = getServiceClient();
    const { data: existing } = await sb.from('payments').select('id').eq('reference', reference).maybeSingle();
    if (existing) return json({ ok: true }, 200);

    const { data: profile } = await sb.from('profiles').select('id, balances').eq('email', email).maybeSingle();
    if (!profile) return json({ ok: true }, 200);

    const { data: rateRow } = await sb.from('xena_settings').select('value').eq('key', 'xena_ngn_rate').maybeSingle();
    const { data: limits } = await sb.from('xena_settings').select('value').eq('key', 'limits').maybeSingle();
    const rate = Number(rateRow?.value?.ngnRate ?? limits?.value?.xenaNgnRate ?? 1500);
    const xenaAmount = Math.round((amountNgn / rate) * 10000) / 10000;

    await sb.rpc('credit_payment', {
      p_reference: reference,
      p_provider: 'flutterwave',
      p_amount: amountNgn,
      p_currency: 'NGN',
      p_email: email,
      p_xena: xenaAmount,
      p_meta: { coin: 'ngn', method: 'flutterwave' },
    });

    return json({ ok: true }, 200);
  } catch (e) {
    console.error('Flutterwave webhook error:', e);
    return json({ ok: true }, 200);
  }
}