import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, readJsonBody, handleError, requireAdminToken, requireSupabase } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!(await requireAdminToken(req))) return json(res, { ok: false, error: 'Admin only.' }, 403);
    const sb = requireSupabase();

    if (req.method === 'GET') {
      const { data, error } = await sb.from('deposits').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return json(res, { ok: true, deposits: data || [] });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const { depositId, decision, note } = body;
      if (!depositId || !decision) return json(res, { ok: false, error: 'Missing depositId or decision.' }, 400);

      const { data: deposit, error: depError } = await sb.from('deposits').select('*').eq('id', depositId).maybeSingle();
      if (depError) throw depError;
      if (!deposit) return json(res, { ok: false, error: 'Deposit not found.' }, 404);
      if (deposit.status !== 'Pending') return json(res, { ok: false, error: 'Already processed.' }, 400);

      if (decision === 'approved') {
        const { error: upErr } = await sb.from('deposits').update({ status: 'Completed', admin_note: note || null, decided_at: new Date().toISOString() }).eq('id', depositId);
        if (upErr) throw upErr;

        const { data: account } = await sb.from('accounts').select('*').eq('email', deposit.email).maybeSingle();
        if (account) {
          const newAvailableXena = (account.balances?.availableXena || 0) + deposit.xena;
          const newTotalBalance = (account.balances?.totalBalance || 0) + deposit.xena;

          const newTx = {
            id: `tx-${Date.now()}-${Math.floor(Math.random() * 999)}`,
            title: 'Naira Deposit (Flutterwave)',
            type: 'deposit',
            amount: deposit.xena,
            unit: 'XENA',
            status: 'Completed',
            timestamp: new Date().toLocaleString(),
            fee: 0,
            reference: deposit.reference,
            paymentMethod: 'Flutterwave · NGN',
          };

          const newNotification = {
            id: `notif-dep-${Date.now()}`,
            title: 'Deposit Approved',
            message: `Your NGN deposit of ₦${deposit.amount.toLocaleString()} was approved. ${deposit.xena.toLocaleString()} XENA credited.`,
            timestamp: 'Just now',
            read: false,
            type: 'transaction',
          };

          await sb.from('accounts').update({
            balances: { ...account.balances, availableXena: newAvailableXena, totalBalance: newTotalBalance },
            transactions: [newTx, ...(account.transactions || [])],
            notifications: [newNotification, ...(account.notifications || [])],
          }).eq('email', deposit.email);
        }
        return json(res, { ok: true });
      }

      if (decision === 'rejected') {
        await sb.from('deposits').update({ status: 'Rejected', admin_note: note || null, decided_at: new Date().toISOString() }).eq('id', depositId);
        return json(res, { ok: true });
      }

      return json(res, { ok: false, error: 'Invalid decision.' }, 400);
    }

    return json(res, { ok: false, error: 'Method not allowed.' }, 405);
  } catch (e) {
    return handleError(e, res);
  }
}