import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRawBody, getSetting, findPendingPayment, updatePendingPayment, creditUser } from '../_lib/helpers.js';

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

    const pay = findPendingPayment('flutterwave', reference);
    if (pay && pay.status === 'confirmed') return res.status(200).json({ ok: true });

    let amount = amountNgn;
    let verified = false;
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    if (secret && tx.id) {
      try {
        const v = await fetch(`https://api.flutterwave.com/v3/transactions/${tx.id}/verify`, {
          headers: { Authorization: `Bearer ${secret}` },
        });
        const vd = await v.json();
        if (vd?.status === 'success' && vd?.data?.status === 'successful') {
          amount = Number(vd.data.amount || amount);
          verified = true;
        }
      } catch {
        verified = false;
      }
    }

    if (verified && pay) {
      const rateSetting = getSetting('xena_ngn_rate');
      const limits = getSetting('limits');
      const rate = Number(rateSetting?.ngnRate ?? limits?.xenaNgnRate ?? 0.3333);
      const xena = Math.round((amount / rate) * 10000) / 10000;
      updatePendingPayment(reference, { status: 'confirmed', xena });
      creditUser(email, xena, {
        title: 'Naira Deposit (Flutterwave)',
        type: 'deposit',
        paymentMethod: 'Flutterwave · NGN',
        counterparty: 'Flutterwave',
        notifTitle: 'Flutterwave Deposit Confirmed',
        notifMessage: `Your NGN deposit was verified. ${xena.toLocaleString()} XENA has been credited to your balance.`,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Flutterwave webhook error:', e);
    return res.status(200).json({ ok: true });
  }
}