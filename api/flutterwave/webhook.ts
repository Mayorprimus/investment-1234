import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readRawBody, getSetting, findPendingPayment, findPendingPaymentByEmail, updatePendingPayment, requireSupabase, savePendingPayment, appendBlobDeposit } from '../_lib/helpers.js';

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
    if (!email) return res.status(200).json({ ok: true });

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

    if (verified) {
      const rateSetting = await getSetting('xena_ngn_rate');
      const limits = await getSetting('limits');
      const rate = Number(rateSetting?.ngnRate ?? limits?.xenaNgnRate ?? 0.3333);
      const xena = Math.round((amount / rate) * 10000) / 10000;

      const byRef = await findPendingPayment('flutterwave', reference);
      if (byRef) {
        if (byRef.status !== 'confirmed' && byRef.status !== 'completed') {
          await updatePendingPayment(reference, { status: 'pending', xena, amount: amountNgn, email });
        }
      } else {
        const byEmail = await findPendingPaymentByEmail('flutterwave', email);
        if (byEmail && byEmail.status === 'pending') {
          // Reconcile the deposit the user already submitted from "I've Paid".
          await updatePendingPayment(byEmail.reference, { xena, amount: amountNgn, meta: { ...(byEmail.meta || {}), flutterwave_tx: tx } });
        } else {
          await savePendingPayment({
            reference,
            provider: 'flutterwave',
            email,
            amount: amountNgn,
            currency: 'NGN',
            xena,
            status: 'pending',
            meta: { flutterwave_tx: tx },
          }).catch(async (e) => {
            console.warn('Flutterwave webhook: savePendingPayment failed', e?.message || e);
          });
        }
      }

      try {
        const { data: adminDeposits } = await requireSupabase().from('payments').select('id,email,amount,currency,xena,status,reference,created_at').eq('provider', 'flutterwave').eq('email', email).order('created_at', { ascending: false }).limit(1);
        const paymentRow = adminDeposits?.[0];
        if (paymentRow) {
          const { data: profile } = await requireSupabase().from('profiles').select('name').eq('email', email).maybeSingle();
          await appendBlobDeposit({
            id: paymentRow.id,
            user: profile?.name || email.split('@')[0],
            email,
            method: 'Flutterwave · NGN',
            amount: amountNgn,
            unit: 'NGN',
            xena,
            status: paymentRow.status === 'pending' ? 'Pending' : 'Completed',
            time: 'Just now',
            reference: paymentRow.reference,
          });
        }
      } catch (e) {
        console.warn('Flutterwave webhook: admin ledger mirror failed', e?.message || e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Flutterwave webhook error:', e);
    return res.status(200).json({ ok: true });
  }
}