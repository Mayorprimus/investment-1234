import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAppUrl, requireEnv, json, readJsonBody, handleError, getUserByToken, getSetting, savePendingPayment, requireSupabase, appendBlobDeposit } from '../_lib/helpers.js';

const SUPPORTED_COINS: Record<string, string> = {
  usdt: 'usdttrc20',
  usdc: 'usdctrc20',
  btc: 'btc',
  sol: 'sol',
  eth: 'eth',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const coin = String(body?.coin || '').toLowerCase();
    const amountUsd = Number(body?.amountUsd || 0);

    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    if (!SUPPORTED_COINS[coin]) return json(res, { ok: false, error: 'Unsupported coin.' }, 400);
    if (!(amountUsd > 0)) return json(res, { ok: false, error: 'Invalid amount.' }, 400);

    const user = await getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);
    const email = String(user.email || '').trim().toLowerCase();

    const limits = await getSetting('limits');
    const minUsd = Number(limits?.minDepositUsd ?? 10);
    if (amountUsd < minUsd) return json(res, { ok: false, error: `Minimum deposit is $${minUsd}.` }, 400);

    const priceSetting = await getSetting('price');
    const price = Number(priceSetting?.price ?? 0.0002564);

    const apiKey = requireEnv('NOWPAYMENTS_API_KEY');
    const currency = SUPPORTED_COINS[coin];
    const base = getAppUrl() || `https://${req.headers.host || ''}`;

    const invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: 'usd',
        pay_currency: currency,
        order_id: `xena-${email}-${Date.now()}`,
        order_description: `XENA deposit via ${coin.toUpperCase()}`,
        ipn_callback_url: `${base}/api/crypto/ipn`,
        success_url: `${base}/wallet`,
        cancel_url: `${base}/wallet`,
      }),
    });
    const invoice = await invoiceRes.json();

    if (!invoiceRes.ok || !invoice?.id) {
      return json(res, { ok: false, error: invoice?.message || 'NOWPayments rejected the invoice.' }, 502);
    }

    const reference = String(invoice.payment_id || invoice.id);
    await savePendingPayment({
      id: `pp-${Date.now()}`,
      reference,
      provider: 'nowpayments',
      email,
      name: user.name || '',
      amount: amountUsd,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date().toISOString(),
      meta: { coin, invoice_id: String(invoice.id) },
    });

    // Mirror to the admin Deposit Ledger so it shows instantly as a pending payment.
    try {
      const sb = requireSupabase();
      const { data: paymentRow } = await sb.from('payments').select('id,status').eq('reference', reference).maybeSingle();
      if (paymentRow) {
        await appendBlobDeposit({
          id: paymentRow.id,
          user: (user.name || email.split('@')[0]) as string,
          email,
          method: `NOWPayments · ${coin.toUpperCase()}`,
          amount: amountUsd,
          unit: 'USD',
          xena: Math.round((amountUsd / price) * 10000) / 10000,
          status: 'Pending',
          time: 'Just now',
          reference,
        });
      }
    } catch (e) {
      console.warn('crypto create: admin ledger mirror failed', (e as any)?.message || e);
    }

    return json(res, {
      ok: true,
      payment_id: reference,
      pay_address: invoice?.pay_address || null,
      pay_amount: Number(invoice?.pay_amount || amountUsd),
      pay_currency: invoice?.pay_currency || currency,
      status: invoice?.payment_status || 'waiting',
      invoice_url: invoice?.invoice_url || null,
    });
  } catch (e) {
    return handleError(e, res);
  }
}