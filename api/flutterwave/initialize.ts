import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, readJsonBody, handleError, getUserByToken } from '../_lib/helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);
    const body = await readJsonBody(req);
    const token = String(body?.token || '');
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);

    const user = await getUserByToken(token);
    if (!user) return json(res, { ok: false, error: 'Invalid session.' }, 401);

    return json(res, {
      ok: false,
      error: 'Flutterwave direct API initialization is deprecated. Use the static payment link: https://flutterwave.com/pay/pkbiacgkyrra',
    }, 410);
  } catch (e) {
    return handleError(e, res);
  }
}