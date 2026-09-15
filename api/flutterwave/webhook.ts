import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, readRawBody } from '../_lib/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(200).json({ ok: true });
    const raw = await readRawBody(req);
    const signature = req.headers['verif-hash'] || req.headers['x-flutterwave-signature'] || '';
    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '';

    if (secretHash && signature !== secretHash) {
      console.warn('Flutterwave webhook: invalid signature');
      return res.status(200).json({ ok: true });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return res.status(200).json({ ok: true });
    }

    const event = body?.event;
    if (event !== 'charge.completed') return res.status(200).json({ ok: true });

    const tx = body?.data;
    if (!tx || tx.status !== 'successful' || tx.currency !== 'NGN') return res.status(200).json({ ok: true });

    const reference = String(tx.tx_ref || tx.id || '').trim();
    if (!reference) return res.status(200).json({ ok: true });
    const amountNgn = Number(tx.amount || 0);
    const email = String(tx.customer?.email || '').trim().toLowerCase();

    const sb = await getServiceClient();
    const { data: existing } = await sb.from('payments').select('id').eq('reference', reference).maybeSingle();
    if (existing && existing.status === 'confirmed') return res.status(200).json({ ok: true });

    const { data: rateRow } = await sb.from('xena_settings').select('value').eq('key', 'xena_ngn_rate').maybeSingle();
    const { data: limits } = await sb.from('xena_settings').select('value').eq('key', 'limits').maybeSingle();
    const rate = Number(rateRow?.value?.ngnRate ?? limits?.value?.xenaNgnRate ?? 0.3333);
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

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Flutterwave webhook error:', e);
    return res.status(200).json({ ok: true });
  }
}