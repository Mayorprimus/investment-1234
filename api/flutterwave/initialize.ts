import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { getServiceClient, requireEnv, getAppUrl, json, readJsonBody, handleError } from '../_lib/helpers';

// Creates a Flutterwave payment and records a pending payment row. The
// secret stays ONLY in Vercel env vars — never sent to the client.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const amountNgn = Math.round(Number(body?.amountNgn) || 0);
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!amountNgn || amountNgn <= 0) return json(res, { ok: false, error: 'Enter a valid deposit amount.' }, 400);

    const sb = await getServiceClient();
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return json(res, { ok: false, error: 'Invalid session.' }, 401);
    const email = String(u.user.email || '').trim().toLowerCase();

    const { data: limits } = await sb.from('xena_settings').select('value').eq('key', 'limits').maybeSingle();
    const minDeposit = Number(limits?.value?.min_deposit_ngn ?? 3000);
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
      customer: { email, name: u.user.user_metadata?.name || 'XENA User' },
      customizations: { title: 'XENA Deposit', description: `Deposit ₦${amountNgn.toLocaleString()} via Flutterwave`, logo: '' },
      meta: { user_id: u.user.id },
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

    const { error: recErr } = await sb.rpc('record_pending_payment', {
      p_reference: txRef,
      p_provider: 'flutterwave',
      p_amount: amountNgn,
      p_currency: 'NGN',
      p_email: email,
      p_meta: { tx_ref: txRef, payment_link: fwData.data?.link },
    });
    if (recErr) return json(res, { ok: false, error: recErr.message }, 502);

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