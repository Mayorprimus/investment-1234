import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, readRawBody, json, handleError, findPendingPayment, updatePendingPayment, creditUser, getSetting, calculateReferralReward, appendBlobDeposit, requireSupabase } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const raw = await readRawBody(req);
    const signature = Array.isArray(req.headers['x-nowpayments-sig']) ? req.headers['x-nowpayments-sig'][0] : (req.headers['x-nowpayments-sig'] || '');
    const secret = requireEnv('NOWPAYMENTS_IPN_SECRET');

    if (!signature) return json(res, { ok: false, error: 'Missing signature.' }, 401);

    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return json(res, { ok: false, error: 'Invalid signature.' }, 401);
    }

    const parsed = JSON.parse(raw);
    const paymentId = String(parsed?.payment_id || parsed?.id || '');
    if (!paymentId) return json(res, { ok: true });
    const status = String(parsed?.payment_status || parsed?.status || '');
    if (!['confirmed', 'finished'].includes(status)) return json(res, { ok: true });

    const pay = await findPendingPayment('nowpayments', paymentId);
    if (!pay) return json(res, { ok: true });
    if (pay.status === 'confirmed') return json(res, { ok: true });

    const amount = Number(parsed?.fiat_amount || parsed?.price_amount || pay.amount || 0);
    const priceSetting = await getSetting('price');
    const price = Number(priceSetting?.price ?? 0.0002564);
    const xena = Math.round((amount / price) * 10000) / 10000;

    await updatePendingPayment(paymentId, { status: 'confirmed', xena });
    await creditUser(pay.email, xena, {
      title: 'Crypto Deposit (NOWPayments)',
      type: 'deposit',
      paymentMethod: `NOWPayments · ${String(pay.meta?.coin || '').toUpperCase() || 'Crypto'}`,
      counterparty: 'NOWPayments',
      notifTitle: 'Crypto Deposit Confirmed',
      notifMessage: `Your ${String(pay.meta?.coin || '').toUpperCase()} payment was confirmed. ${xena.toLocaleString()} XENA has been credited to your balance.`,
    });

    // Referral bonus: credit referrer $0.38 worth of XENA
    try {
      const sb = requireSupabase();
      const reward = await calculateReferralReward(sb);
      const { data: depositor } = await sb.from('profiles').select('referrer').eq('email', pay.email).maybeSingle();
      if (depositor?.referrer) {
        const { data: referrer } = await sb.from('profiles').select('email, name').eq('referral_code', depositor.referrer).maybeSingle();
        if (referrer && referrer.email !== pay.email) {
          await creditUser(referrer.email, reward, {
            title: 'Referral Bonus',
            type: 'referral',
            notifTitle: 'Referral Deposit Bonus',
            notifMessage: `Your referral completed a deposit. +${reward.toLocaleString()} XENA credited!`,
          });
        }
      }
    } catch (e) {
      console.warn('NOWPayments IPN: referral bonus failed', e?.message || e);
    }

    // Update admin_state blob to reflect the confirmed payment
    try {
      const sb = requireSupabase();
      const { data: adminDeposits } = await sb.from('payments').select('id,email,amount,currency,xena,status,reference,created_at').eq('provider', 'nowpayments').eq('email', pay.email).order('created_at', { ascending: false }).limit(1);
      const paymentRow = adminDeposits?.[0];
      if (paymentRow) {
        const { data: profile } = await sb.from('profiles').select('name').eq('email', pay.email).maybeSingle();
        await appendBlobDeposit({
          id: paymentRow.id,
          user: profile?.name || pay.email.split('@')[0],
          email: pay.email,
          method: `NOWPayments · ${String(pay.meta?.coin || '').toUpperCase() || 'Crypto'}`,
          amount: Math.round(amount / price),
          unit: 'USD',
          xena,
          status: 'Completed',
          time: 'Just now',
          reference: paymentRow.reference,
        });
      }
    } catch (e) {
      console.warn('NOWPayments IPN: admin ledger mirror failed', e?.message || e);
    }

    return json(res, { ok: true });
  } catch (e) {
    return handleError(e, res);
  }
}