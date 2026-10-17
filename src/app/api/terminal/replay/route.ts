import { hasDb } from '@/lib/db';
import { fail, safeError } from '@/lib/http';
import { replayEvents } from '@/lib/terminal/replay';

export async function GET() {
  if (!hasDb()) return fail('Not connected', 503);
  try {
    return new Response(JSON.stringify({ ok: true, events: await replayEvents() }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=600' } });
  } catch (e) {
    console.error('replay events', safeError(e));
    return fail('Could not load past releases.', 500, safeError(e));
  }
}
