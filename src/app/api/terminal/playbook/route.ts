import { hasDb } from '@/lib/db';
import { fail, safeError } from '@/lib/http';
import { playbookFor } from '@/lib/terminal/playbook';

/** GET /api/terminal/playbook?id=<event id>: outcome ladder with what markets did in past releases. */
export async function GET(req: Request) {
  if (!hasDb()) return fail('Not connected', 503);
  const id = (new URL(req.url).searchParams.get('id') || '').slice(0, 160);
  if (!id) return fail('Missing event');
  try {
    const p = await playbookFor(id);
    if (!p) return fail('Event not found', 404);
    return new Response(JSON.stringify({ ok: true, ...p }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': p.actual ? 'public, s-maxage=3600' : 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    console.error('playbook', safeError(e));
    return fail('Could not load the playbook.', 500, safeError(e));
  }
}
