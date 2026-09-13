import { getServiceClient, json, readJsonBody, handleError } from '../_lib/helpers';

// Called right after auth.signUp to auto-confirm the new user — no email
// confirmation step (instant login).
export default async function handler(req: Request) {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email) return json({ ok: false, error: 'Missing email.' }, 400);

    const sb = getServiceClient();
    const { data: page, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return json({ ok: false, error: error.message }, 500);
    const user = page.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) return json({ ok: false, error: 'User not found.' }, 404);

    const { error: updateErr } = await sb.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (updateErr) return json({ ok: false, error: updateErr.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}