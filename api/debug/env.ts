import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const urlPrefix = process.env.SUPABASE_URL?.slice(0, 30) || 'undefined';
  const keyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) || 'undefined';

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    env: {
      SUPABASE_URL: hasUrl ? `${urlPrefix}...` : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: hasKey ? `${keyPrefix}...` : 'MISSING',
      FLUTTERWAVE_SECRET_KEY: !!process.env.FLUTTERWAVE_SECRET_KEY ? 'SET' : 'MISSING',
      NOWPAYMENTS_API_KEY: !!process.env.NOWPAYMENTS_API_KEY ? 'SET' : 'MISSING',
      APP_URL: process.env.APP_URL || 'MISSING',
    },
    note: 'Check Vercel → Project → Settings → Environment Variables → ensure these are set for Production environment'
  });
}