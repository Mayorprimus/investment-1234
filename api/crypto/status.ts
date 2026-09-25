import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, json, readJsonBody, handleError, getUserByToken, getSetting, findPendingPayment, updatePendingPayment, requireSupabase, appendBlobDeposit, creditPayment } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const paymentId = String(body?.payment_id || body?.reference || '').trim();
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!paymentId) return json(res, { ok: false, error: 'Missing payment_id.' }, 400);

    const user = await getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    const pay = await findPendingPayment('nowpayments', paymentId);
    if (!pay) return json(res, { ok: false, error: 'Payment not found.' }, 404);
    if (pay.email?.toLowerCase() !== String(user.email || '').toLowerCase()) {
      return json(res, { ok: false, error: 'This payment belongs to another account.' }, 403);
    }

    if (pay.status === 'confirmed') {
      return json(res, { ok: true, status: pay.status, xena: Number(pay.xena || 0), duplicate: true });
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
    const priceSetting = await getSetting('price');
    const price = Number(priceSetting?.price ?? 0.0002564);
    const xena = Math.round((amountFiat / price) * 10000) / 10000;

    await updatePendingPayment(paymentId, { status: 'confirmed', xena });
    await creditPayment(paymentId, 'nowpayments', amountFiat, 'USD', xena, pay.email, pay.meta);

    // Mirror to the admin Deposit Ledger so it shows as Completed.
    try {
      const sb = requireSupabase();
      const { data: paymentRow } = await sb.from('payments').select('id,status').eq('reference', paymentId).maybeSingle();
      if (paymentRow) {
        const { data: profile } = await sb.from('profiles').select('name').eq('email', pay.email).maybeSingle();
        await appendBlobDeposit({
          id: paymentRow.id,
          user: profile?.name || pay.email.split('@')[0],
          email: pay.email,
          method: `NOWPayments · ${String(pay.meta?.coin || '').toUpperCase() || 'Crypto'}`,
          amount: Math.round(amountFiat * 100) / 100,
          unit: 'USD',
          xena,
          status: 'Completed',
          time: 'Just now',
          reference: paymentId,
        });
      }
    } catch (e) {
      console.warn('crypto status: admin ledger mirror failed', (e as any)?.message || e);
    }

    return json(res, { ok: true, status: 'confirmed', xena: Number(xena), duplicate: false });
  } catch (e) {
    return handleError(e, res);
  }
}