import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, json, readJsonBody, handleError, getUserByToken, getSetting, findPendingPayment, updatePendingPayment, creditUser } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const txRef = String(body?.tx_ref || body?.reference || '').trim();
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!txRef) return json(res, { ok: false, error: 'Missing tx_ref/reference.' }, 400);

    const user = getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    const secret = requireEnv('FLUTTERWAVE_SECRET_KEY');
    const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, {
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

    const pay = await findPendingPayment('flutterwave', txRef);
    if (!pay) return json(res, { ok: false, error: 'Payment not found.' }, 404);
    if (pay.status === 'confirmed') {
      return json(res, { ok: true, xena: pay.xena || 0, duplicate: true });
    }
    if (pay.email?.toLowerCase() !== String(user.email || '').toLowerCase()) {
      return json(res, { ok: false, error: 'This payment belongs to another account.' }, 403);
    }

    await updatePendingPayment(txRef, { status: 'confirmed', xena: xenaAmount });
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