import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getAppUrl, requireEnv, json, readJsonBody, handleError, getUserByToken, getSetting, savePendingPayment } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const amountNgn = Math.round(Number(body?.amountNgn) || 0);
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!amountNgn || amountNgn <= 0) return json(res, { ok: false, error: 'Enter a valid deposit amount.' }, 400);

    const user = await getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);
    const email = String(user.email || '').trim().toLowerCase();

    const limits = await getSetting('limits');
    const minDeposit = Number(limits?.min_deposit_ngn ?? 3000);
    if (amountNgn < minDeposit) {
      return json(res, { ok: false, error: `Minimum deposit is ₦${minDeposit.toLocaleString()}.` }, 400);
    }

    const secret = requireEnv('FLUTTERWAVE_SECRET_KEY');
    const publicKey = requireEnv('FLUTTERWAVE_PUBLIC_KEY');
    const base = getAppUrl() || `https://${req.headers.host || ''}`;
    const txRef = 'xena-' + crypto.randomUUID().replace(/-/g, '');

    const payload = {
      tx_ref: txRef,
      amount: amountNgn,
      currency: 'NGN',
      redirect_url: `${base}/wallet?flutterwave_status=success`,
      payment_options: 'banktransfer,card,ussd',
      customer: { email, name: user.name || 'XENA User' },
      customizations: { title: 'XENA Deposit', description: `Deposit ₦${amountNgn.toLocaleString()} via Flutterwave`, logo: '' },
      meta: { email },
    };

    const fwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const fwData = await fwRes.json();
    if (!fwRes.ok || fwData?.status !== 'success') {
      return json(res, { ok: false, error: fwData?.message || 'Unable to initialize Flutterwave payment.' }, 502);
    }

    savePendingPayment({
      id: `pp-${Date.now()}`,
      reference: txRef,
      provider: 'flutterwave',
      email,
      name: user.name || '',
      amount: amountNgn,
      currency: 'NGN',
      status: 'pending',
      createdAt: new Date().toISOString(),
      meta: { tx_ref: txRef, payment_link: fwData.data?.link },
    });

    return json(res, {
      ok: true,
      reference: txRef,
      tx_ref: txRef,
      payment_link: fwData.data?.link,
      public_key: publicKey,
    });
  } catch (e) {
    return handleError(e, res);
  }
}