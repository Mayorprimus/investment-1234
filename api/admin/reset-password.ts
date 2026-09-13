import { getServiceClient, json, readJsonBody, handleError, requireAdminToken } from '../_lib/helpers';

// Admin resets a user's password. New password is written via admin API;
// the user then logs in with it (instant login, no email confirmation).
export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    await requireAdminToken(req, body);

    const sb = getServiceClient();
    const email = String(body?.email || '').trim().toLowerCase();
    const newPassword = String(body?.password || '');
    if (!email) return json({ ok: false, error: 'Email is required.' }, 400);
    if (newPassword.length < 8) return json({ ok: false, error: 'Password must be at least 8 characters.' }, 400);

    const { data: users, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) return json({ ok: false, error: listErr.message }, 502);

    const match = users?.users.find((u: any) => String(u.email || '').toLowerCase() === email);
    if (!match) return json({ ok: false, error: 'User not found.' }, 404);

    const { error } = await sb.auth.admin.updateUserById(match.id, { password: newPassword });
    if (error) return json({ ok: false, error: error.message }, 502);

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}