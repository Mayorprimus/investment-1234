import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, json, readJsonBody, handleError, getUserByToken, getSetting, findPendingPayment, findPendingPaymentByEmail, updatePendingPayment, creditUser } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);

    const user = getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    const pay = await findPendingPaymentByEmail('flutterwave', String(user.email || '').toLowerCase());
    if (!pay || !pay.reference) {
      return json(res, { ok: false, error: 'No pending Flutterwave payment found for your account. Complete the payment first.' }, 404);
    }
    if (pay.status === 'confirmed') {
      return json(res, { ok: true, xena: pay.xena || 0, duplicate: true });
    }

    const secret = requireEnv('FLUTTERWAVE_SECRET_KEY');
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(pay.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || verifyData?.status !== 'success') {
      return json(res, { ok: false, error: verifyData?.message || 'Payment not confirmed.' }, 400);
    }

    const tx = verifyData.data;
    if (tx.status !== 'successful') {
      return json(res, { ok: false, error: `Payment status: ${tx.status}` }, 400);
    }
    if (tx.currency !== 'NGN') {
      return json(res, { ok: false, error: 'Unexpected currency.' }, 400);
    }

    const amountNgn = Number(tx.amount || 0);
    const rateSetting = await getSetting('xena_ngn_rate');
    const limits = await getSetting('limits');
    const rate = Number(rateSetting?.ngnRate ?? limits?.xenaNgnRate ?? 0.3333);
    const xenaAmount = Math.round((amountNgn / rate) * 10000) / 10000;

    await updatePendingPayment(pay.reference, { status: 'confirmed', xena: xenaAmount });
    await creditUser(String(user.email || ''), xenaAmount, {
      title: 'Naira Deposit (Flutterwave)',
      type: 'deposit',
      paymentMethod: 'Flutterwave · NGN',
      counterparty: 'Flutterwave',
      notifTitle: 'Flutterwave Deposit Confirmed',
      notifMessage: `Your NGN deposit was verified. ${xenaAmount.toLocaleString()} XENA has been credited to your balance.`,
    });

    return json(res, { ok: true, xena: xenaAmount });
  } catch (e) {
    return handleError(e, res);
  }
}