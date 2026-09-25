import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, readJsonBody, handleError, requireAdminToken, requireSupabase, creditUser, updateBlobDeposit, calculateReferralReward, creditPayment } from '../_lib/helpers.js';

const toDisplayStatus = (status: string): string => {
  const s = String(status || '').toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'completed' || s === 'confirmed') return 'Completed';
  if (s === 'rejected') return 'Rejected';
  return status || 'Pending';
};

const getProviderLabel = (provider: string, currency: string): string => {
  const p = String(provider || '').toLowerCase();
  if (p === 'flutterwave') return `Flutterwave · ${currency}`;
  if (p === 'nowpayments') return `NOWPayments · ${currency}`;
  return provider || 'Unknown';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!(await requireAdminToken(req))) return json(res, { ok: false, error: 'Admin only.' }, 403);
    const sb = requireSupabase();

    if (req.method === 'GET') {
      const { data, error } = await sb
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const deposits = (data || []).map((p: any) => ({
        id: p.id,
        user: p.email ? String(p.email).split('@')[0] : 'Unknown',
        email: p.email,
        provider: p.provider,
        method: getProviderLabel(p.provider, p.currency),
        amount: Number(p.amount || 0),
        unit: p.currency || 'USD',
        xena: Number(p.xena || 0),
        status: toDisplayStatus(p.status),
        reference: p.reference,
        created_at: p.created_at,
      }));
      return json(res, { ok: true, deposits });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { depositId, decision, note } = body;
      if (!depositId || !decision) return json(res, { ok: false, error: 'Missing depositId or decision.' }, 400);

      const { data: deposit, error: depError } = await sb.from('payments').select('*').eq('id', depositId).maybeSingle();
      if (depError) throw depError;
      if (!deposit) return json(res, { ok: false, error: 'Deposit not found.' }, 404);
      if (deposit.status === 'completed' || deposit.status === 'rejected') {
        return json(res, { ok: false, error: 'Already processed.' }, 400);
      }

      if (decision === 'approved') {
        const email = String(deposit.email || '').toLowerCase();
        const xena = Number(deposit.xena || 0);
        const amount = Number(deposit.amount || 0);
        const currency = deposit.currency || 'USD';
        const provider = deposit.provider || 'unknown';

        const isNgn = provider === 'flutterwave' && currency === 'NGN';
        const title = isNgn ? 'Naira Deposit (Flutterwave)' : 'Crypto Deposit (NOWPayments)';
        const notifTitle = isNgn ? 'NGN Deposit Approved' : 'Crypto Deposit Approved';
        const notifMsg = isNgn
          ? `Your NGN deposit of ₦${amount.toLocaleString()} was approved. ${xena.toLocaleString()} XENA credited.`
          : `Your ${currency} deposit of ${amount.toLocaleString()} was approved. ${xena.toLocaleString()} XENA credited.`;

        // Credit depositor via credit_payment RPC (handles welcome bonuses: ₦1,500 NGN / $10 crypto for first deposits).
        // Fall back to creditUser if the RPC isn't deployed in the DB yet so approval ALWAYS credits the balance.
        try {
          await creditPayment(deposit.reference, provider, amount, currency, xena, email, {
            admin_approved: true,
            admin_note: note || null,
          });
        } catch (rpcErr) {
          console.warn('Admin approve deposit: credit_payment RPC failed, falling back to creditUser', (rpcErr as any)?.message || rpcErr);
          await creditUser(email, xena, {
            title,
            type: 'deposit',
            paymentMethod: getProviderLabel(provider, currency),
            counterparty: provider === 'flutterwave' ? 'Flutterwave' : 'NOWPayments',
            reference: deposit.reference,
            amount,
            notifTitle,
            notifMessage: notifMsg,
          });
        }

        // Referral bonus: credit referrer $0.38 worth of XENA
        try {
          const reward = await calculateReferralReward(sb);
          const { data: depositor } = await sb.from('profiles').select('referrer').eq('email', email).maybeSingle();
          if (depositor?.referrer) {
            const { data: referrer } = await sb.from('profiles').select('email, name').eq('referral_code', depositor.referrer).maybeSingle();
            if (referrer && referrer.email !== email) {
              await creditUser(referrer.email, reward, {
                title: 'Referral Bonus',
                type: 'referral',
                notifTitle: 'Referral Deposit Bonus',
                notifMessage: `Your referral completed a deposit. +${reward.toLocaleString()} XENA credited!`,
              });
            }
          }
        } catch (e) {
          console.warn('Admin approve deposit: referral bonus failed', e?.message || e);
        }

        const { error: upErr } = await sb
          .from('payments')
          .update({ status: 'completed', meta: { ...(deposit.meta || {}), admin_note: note || null }, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', depositId);
        if (upErr) throw upErr;

        await updateBlobDeposit(depositId, { status: 'Completed', time: 'Just now' }).catch(() => {});
        return json(res, { ok: true });
      }

      if (decision === 'rejected') {
        await sb
          .from('payments')
          .update({ status: 'rejected', meta: { ...(deposit.meta || {}), admin_note: note || null }, updated_at: new Date().toISOString() })
          .eq('id', depositId);
        await updateBlobDeposit(depositId, { status: 'Rejected', time: 'Just now' }).catch(() => {});
        return json(res, { ok: true });
      }

      return json(res, { ok: false, error: 'Invalid decision.' }, 400);
    }

    return json(res, { ok: false, error: 'Method not allowed.' }, 405);
  } catch (e) {
    return handleError(e, res);
  }
}