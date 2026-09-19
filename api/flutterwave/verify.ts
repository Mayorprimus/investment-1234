import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  json,
  readJsonBody,
  handleError,
  getUserByToken,
  getSetting,
  findPendingPaymentByEmail,
  requireSupabase,
  savePendingPayment,
  appendBlobDeposit,
} from '../_lib/helpers.js';

const PENDING_MESSAGE = 'Payment received — awaiting admin approval. Your XENA will be credited once approved (usually within a few minutes).';

async function registerPendingDeposit(email: string, amountNgn: number): Promise<number> {
  const rateSetting = await getSetting('xena_ngn_rate');
  const limits = await getSetting('limits');
  const rate = Number(rateSetting?.ngnRate ?? limits?.xenaNgnRate ?? 0.3333);
  const xena = Math.round((amountNgn / rate) * 10000) / 10000;
  const reference = `fw-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  await savePendingPayment({
    provider: 'flutterwave',
    reference,
    email,
    amount: amountNgn,
    currency: 'NGN',
    xena,
    status: 'pending',
    meta: { source: 'user-verified', submitted_at: new Date().toISOString() },
  });

  try {
    const sb = requireSupabase();
    const { data: paymentRow } = await sb.from('payments').select('id,status').eq('reference', reference).maybeSingle();
    const { data: profile } = await sb.from('profiles').select('name').eq('email', email).maybeSingle();
    if (paymentRow) {
      await appendBlobDeposit({
        id: paymentRow.id,
        user: profile?.name || email.split('@')[0],
        email,
        method: 'Flutterwave · NGN',
        amount: Math.round(amountNgn / rate),
        unit: 'USD',
        xena,
        status: 'Pending',
        time: 'Just now',
        reference,
      });
    }
  } catch (e) {
    console.warn('verify: admin ledger mirror failed', (e as any)?.message || e);
  }

  return xena;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);

    const user = await getUserByToken(token);
    if (!user?.email) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    const email = String(user.email).toLowerCase();
    const amountNgn = Number(body?.amountNgn || 0);
    const pay = await findPendingPaymentByEmail('flutterwave', email);

    if (pay && (pay.status === 'confirmed' || pay.status === 'completed')) {
      return json(res, { ok: true, xena: pay.xena || 0, duplicate: true });
    }

    if (pay && pay.status === 'pending') {
      return json(res, { ok: false, pending: true, xena: pay.xena || 0, error: PENDING_MESSAGE }, 202);
    }

    // No (active) payment on record — register one from the amount the user says
    // they paid so it surfaces in the admin portal for manual approval.
    if (amountNgn > 0) {
      const xena = await registerPendingDeposit(email, amountNgn);
      return json(res, { ok: false, pending: true, xena, error: PENDING_MESSAGE }, 202);
    }

    return json(res, { ok: false, error: 'No pending Flutterwave payment found for your account. Complete the payment first.' }, 404);
  } catch (e) {
    return handleError(e, res);
  }
}
