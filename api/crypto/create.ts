import { getServiceClient, requireEnv, json, readJsonBody, handleError } from '../_lib/helpers';

// Creates a NOWPayments invoice for a crypto deposit. Records a pending
// payment row so the IPN webhook can match and credit idempotently.
const SUPPORTED_COINS: Record<string, string> = {
  usdt: 'usdttrc20',
  usdc: 'usdctrc20',
  btc: 'btc',
  sol: 'sol',
  eth: 'eth',
};

export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    const coin = String(body?.coin || '').toLowerCase();
    const amountUsd = Number(body?.amountUsd || 0);

    if (!token) return json({ ok: false, error: 'Not authenticated.' }, 401);
    if (!SUPPORTED_COINS[coin]) return json({ ok: false, error: 'Unsupported coin.' }, 400);
    if (!(amountUsd > 0)) return json({ ok: false, error: 'Invalid amount.' }, 400);

    const sb = await getServiceClient();
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return json({ ok: false, error: 'Invalid session.' }, 401);
    const email = String(u.user.email || '').trim().toLowerCase();

    const { data: limits } = await sb.from('xena_settings').select('value').eq('key', 'limits').maybeSingle();
    const minUsd = Number(limits?.limits?.minDepositUsd || 10);
    if (amountUsd < minUsd) return json({ ok: false, error: `Minimum deposit is $${minUsd}.` }, 400);

    const apiKey = requireEnv('NOWPAYMENTS_API_KEY');
    const currency = SUPPORTED_COINS[coin];

    const invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: amountUsd,
        price_currency: 'usd',
        pay_currency: currency,
        order_id: `xena-${u.user.id}-${Date.now()}`,
        order_description: `XENA deposit via ${coin.toUpperCase()}`,
        ipn_callback_url: `https://${req.headers.get('host') || ''}/api/crypto/ipn`,
        success_url: `${req.headers.get('origin') || ''}/wallet`,
        cancel_url: `${req.headers.get('origin') || ''}/wallet`,
      }),
    });
    const invoice = await invoiceRes.json();

    if (!invoiceRes.ok || !invoice?.id) {
      return json({ ok: false, error: invoice?.message || 'NOWPayments rejected the invoice.' }, 502);
    }

    const { data, error } = await sb.rpc('record_pending_payment', {
      p_reference: String(invoice.id),
      p_provider: 'nowpayments',
      p_amount: amountUsd,
      p_currency: 'USD',
      p_email: email,
      p_meta: { coin, method: `crypto-${coin}` },
    });
    if (error) return json({ ok: false, error: error.message }, 502);

    return json({
      ok: true,
      payment_id: String(invoice.id),
      pay_address: invoice?.pay_address || null,
      pay_amount: Number(invoice?.pay_amount || amountUsd),
      pay_currency: invoice?.pay_currency || currency,
      status: invoice?.payment_status || 'waiting',
      invoice_url: invoice?.invoice_url || null,
    });
  } catch (e) {
    return handleError(e);
  }
}