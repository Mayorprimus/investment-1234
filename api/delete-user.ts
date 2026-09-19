import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, json, readJsonBody, handleError, requireAdminToken } from './_lib/helpers.js';

// Hard-deletes a user account: auth user (cascade removes the profile row),
// any investments, p2p offers/trades they own are wiped by FK cascade.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const isAdmin = await requireAdminToken(req, body);
    if (!isAdmin) return json(res, { ok: false, error: 'Admins only.' }, 403);

    const sb = await getServiceClient();
    const userId = String(body?.userId || '');
    const email = String(body?.email || '').trim().toLowerCase();
    if (!userId && !email) return json(res, { ok: false, error: 'Provide userId or email.' }, 400);

    const { data: users, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return json(res, { ok: false, error: listErr.message }, 502);

    const match = users?.users.find(
      (u: any) => (userId && u.id === userId) || (email && String(u.email || '').toLowerCase() === email)
    );
    if (!match) return json(res, { ok: false, error: 'User not found.' }, 404);
    if (String(match.email).toLowerCase() === 'admin12345@gmail.com') {
      return json(res, { ok: false, error: 'Cannot delete the admin account.' }, 403);
    }

    await sb.from('profiles').delete().eq('id', match.id);
    const { error: delErr } = await sb.auth.admin.deleteUser(match.id);
    if (delErr) return json(res, { ok: false, error: delErr.message }, 502);

    return json(res, { ok: true });
  } catch (e) {
    return handleError(e, res);
  }
}