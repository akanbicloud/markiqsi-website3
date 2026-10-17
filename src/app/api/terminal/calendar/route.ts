import { hasDb } from '@/lib/db';
import { fail, safeError } from '@/lib/http';
import { calendarRows } from '@/lib/terminal/calendar';

export async function GET() {
  if (!hasDb()) return fail('Not connected', 503);
  try {
    return new Response(JSON.stringify({ ok: true, events: await calendarRows() }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } });
  } catch (e) {
    console.error('calendar', safeError(e));
    return fail('Could not load the calendar.', 500, safeError(e));
  }
}
