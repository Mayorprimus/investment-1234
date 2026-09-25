import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAppUrl,
  json,
  readJsonBody,
  handleError,
  getUserByToken,
  getSetting,
  savePendingPayment,
  requireSupabase,
  appendBlobDeposit,
} from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const amountNgn = Math.round(Number(body?.amountNgn || 0));

    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!(amountNgn > 0)) return json(res, { ok: false, error: 'Invalid amount.' }, 400);

    const user = await getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);
    const email = String(user.email || '').trim().toLowerCase();

    const limits = await getSetting('limits');
    const minNgn = Number(limits?.min_deposit_ngn ?? 3000);
    if (amountNgn < minNgn) return json(res, { ok: false, error: `Minimum deposit is ₦${minNgn.toLocaleString()}.` }, 400);

    const rateSetting = await getSetting('xena_ngn_rate');
    const rate = Number(rateSetting?.ngnRate ?? limits?.xenaNgnRate ?? 0.266);
    const xena = Math.round((amountNgn / rate) * 10000) / 10000;
    const base = getAppUrl() || `https://${req.headers.host || ''}`;
    // Flutterwave tx_ref must be alphanumeric (+ - _) — user emails (dots, +,
    // symbols) are NOT safe here, so build it from time + random only.
    const txRef = `xena-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    if (!secretKey) {
      return json(res, { ok: false, error: 'Payment provider not configured (FLUTTERWAVE_SECRET_KEY missing).' }, 502);
    }

    const fwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amountNgn,
        currency: 'NGN',
        redirect_url: `${base}/wallet?flutterwave_status=success`,
        customer: {
          email,
          name: String((user.user_metadata || {}).name || email.split('@')[0]),
        },
        customizations: {
          title: 'XENA Deposit',
          description: `Deposit ₦${amountNgn.toLocaleString()} via Flutterwave`,
          logo: '',
        },
      }),
    });
    const fw = await fwRes.json();

    if (!fwRes.ok || fw?.status !== 'success' || !fw?.data?.link) {
      const msg = typeof fw?.message === 'string' ? fw.message : (fw?.data?.message || 'Unable to initialize Flutterwave payment.');
      if (fwRes.status === 401) return json(res, { ok: false, error: 'Payment provider not configured (invalid FLUTTERWAVE_SECRET_KEY).' }, 502);
      return json(res, { ok: false, error: `Flutterwave: ${msg}` }, 502);
    }

    await savePendingPayment({
      reference: txRef,
      provider: 'flutterwave',
      email,
      amount: amountNgn,
      currency: 'NGN',
      xena,
      status: 'pending',
      meta: { tx_ref: txRef, submitted_at: new Date().toISOString() },
    });

    // Mirror to the admin Deposit Ledger so it shows instantly as a pending payment.
    try {
      const sb = requireSupabase();
      const { data: paymentRow } = await sb.from('payments').select('id,status').eq('reference', txRef).maybeSingle();
      if (paymentRow) {
        await appendBlobDeposit({
          id: paymentRow.id,
          user: (String((user.user_metadata || {}).name || email.split('@')[0])) as string,
          email,
          method: 'Flutterwave · NGN',
          amount: amountNgn,
          unit: 'NGN',
          xena,
          status: 'Pending',
          time: 'Just now',
          reference: txRef,
        });
      }
    } catch (e) {
      console.warn('flutterwave initialize: admin ledger mirror failed', (e as any)?.message || e);
    }

    return json(res, { ok: true, paymentLink: fw.data.link, tx_ref: txRef });
  } catch (e) {
    return handleError(e, res);
  }
}