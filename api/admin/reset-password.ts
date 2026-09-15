import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient, json, readJsonBody, handleError, requireAdminToken } from '../_lib/helpers.js';

// Admin resets a user's password. New password is written via admin API;
// the user then logs in with it (instant login, no email confirmation).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const isAdmin = await requireAdminToken(req, body);
    if (!isAdmin) return json(res, { ok: false, error: 'Admins only.' }, 403);

    const sb = await getServiceClient();
    const email = String(body?.email || '').trim().toLowerCase();
    const newPassword = String(body?.password || '');
    if (!email) return json(res, { ok: false, error: 'Email is required.' }, 400);
    if (newPassword.length < 8) return json(res, { ok: false, error: 'Password must be at least 8 characters.' }, 400);

    const { data: users, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return json(res, { ok: false, error: listErr.message }, 502);

    const match = users?.users.find((u: any) => String(u.email || '').toLowerCase() === email);
    if (!match) return json(res, { ok: false, error: 'User not found.' }, 404);

    const { error } = await sb.auth.admin.updateUserById(match.id, { password: newPassword });
    if (error) return json(res, { ok: false, error: error.message }, 502);

    return json(res, { ok: true });
  } catch (e) {
    return handleError(e, res);
  }
}