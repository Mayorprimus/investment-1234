import { json } from './_lib/helpers';

export default async function handler(_req: any, res: any) {
  try {
    return json(res, { ok: true, probe: 'helpers-only' });
  } catch (e) {
    return json(res, { ok: false, error: String(e) }, 500);
  }
}