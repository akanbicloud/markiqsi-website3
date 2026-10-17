import { hasDb } from '@/lib/db';
import { fail, safeError } from '@/lib/http';
import { chartData } from '@/lib/terminal/data';
import { MARKETS } from '@/lib/terminal/pressure';

/** GET /api/terminal/chart?market=XAUUSD : candles with MarkIQ Pressure and the events pinned to them. */
export async function GET(req: Request) {
  if (!hasDb()) return fail('Not connected', 503);
  const u = new URL(req.url);
  const market = (u.searchParams.get('market') || 'XAUUSD').toUpperCase();
  if (!MARKETS.some((m) => m.key === market)) return fail('Unknown market');
  try {
    const d = await chartData(market, '1h', Math.min(400, Math.max(60, Number(u.searchParams.get('bars')) || 240)));
    if (!d) return fail('Price history for this market is still loading. Please try again in a few minutes.', 503);
    return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (e) {
    console.error('terminal chart', safeError(e));
    return fail('Could not load the chart.', 500, safeError(e));
  }
}
