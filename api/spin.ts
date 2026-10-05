import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, readJsonBody, handleError, getUserByToken, creditUser, getAdminBlob, setAdminBlob } from '../_lib/helpers.js';

// Daily spin: once per 24h per account. Weighted odds — 1000 XENA lands
// ~10% of spins (≈10 of every 100), the rest share the remaining 90%.
const SPIN_WINDOW_MS = 24 * 60 * 60 * 1000;
const REWARDS = [
  { xena: 1000, weight: 10 },
  { xena: 500, weight: 20 },
  { xena: 300, weight: 30 },
  { xena: 100, weight: 25 },
  { xena: 50, weight: 15 },
];

async function lastSpin(email: string): Promise<number> {
  const blob = await getAdminBlob();
  const map = blob.dailySpin || {};
  const v = map[email];
  const t = typeof v === 'number' ? v : Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : 0;
}

async function recordSpin(email: string): Promise<void> {
  const blob = await getAdminBlob();
  const map = blob.dailySpin || {};
  map[email] = Date.now();
  await setAdminBlob({ ...blob, dailySpin: map });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = String(req.query?.token || (req.method === 'POST' ? (await readJsonBody(req))?.token : '') || '');
    if (!token) return json(res, { ok: false, error: 'Not authenticated.' }, 401);
    const user = await getUserByToken(token);
    if (!user?.email) return json(res, { ok: false, error: 'Invalid session.' }, 401);
    const email = String(user.email).toLowerCase();

    if (req.method === 'GET') {
      const last = await lastSpin(email);
      const canSpin = Date.now() - last >= SPIN_WINDOW_MS;
      return json(res, { ok: true, canSpin, nextSpinAt: canSpin ? Date.now() : last + SPIN_WINDOW_MS });
    }

    if (req.method !== 'POST') return json(res, { ok: false, error: 'Method not allowed.' }, 405);

    const last = await lastSpin(email);
    if (Date.now() - last < SPIN_WINDOW_MS) {
      return json(res, { ok: false, error: 'You have already spun today.', nextSpinAt: last + SPIN_WINDOW_MS }, 429);
    }

    const total = REWARDS.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    let reward = REWARDS[REWARDS.length - 1].xena;
    for (const r of REWARDS) {
      if (roll < r.weight) { reward = r.xena; break; }
      roll -= r.weight;
    }

    await recordSpin(email);
    await creditUser(email, reward, {
      title: 'Daily Spin Reward',
      type: 'bonus',
      notifTitle: 'Daily Spin Reward',
      notifMessage: `You won ${reward.toLocaleString()} XENA on the daily spin!`,
    });

    return json(res, { ok: true, reward });
  } catch (e) {
    return handleError(e, res);
  }
}
