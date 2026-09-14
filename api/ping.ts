export default async function handler(req: Request) {
  return new Response(JSON.stringify({ ok: true, pong: 'no-deps' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}