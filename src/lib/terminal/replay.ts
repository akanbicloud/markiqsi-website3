import { db } from '../db';
import type { Candle } from '../trading/indicators';
import { fetchTwelve } from '../trading/prices';
import { SYMBOLS } from '../trading/symbols';

export type ReplayEvent = { name: string; at: string; actual: string | null; forecast: string | null; previous: string | null; surprise: string | null };

/** Releases that can be replayed: recorded reactions and official results of the last two years. */
export async function replayEvents(): Promise<ReplayEvent[]> {
  const q = await db();
  const rows = (await q`
    SELECT name, at, actual, forecast, previous, surprise FROM (
      SELECT DISTINCT ON (event_name, released_at) event_name AS name, released_at AS at, actual, forecast, previous, surprise
      FROM mi_reactions WHERE released_at > now() - interval '2 years' AND released_at < now() - interval '2 hours'
      UNION ALL
      SELECT country || ' ' || name, released_at, actual, forecast, previous, verdict FROM mi_results
      WHERE released_at > now() - interval '60 days' AND released_at < now() - interval '2 hours'
    ) x ORDER BY at DESC LIMIT 400`) as Record<string, unknown>[];
  const seen = new Set<string>();
  const out: ReplayEvent[] = [];
  for (const r of rows) {
    const at = r.at instanceof Date ? r.at.toISOString() : new Date(String(r.at)).toISOString();
    const k = `${String(r.name).toLowerCase()}|${at.slice(0, 16)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: String(r.name), at, actual: (r.actual as string) ?? null, forecast: (r.forecast as string) ?? null, previous: (r.previous as string) ?? null, surprise: (r.surprise as string) ?? null });
  }
  return out;
}

/** 15-minute candles from 3 hours before to 9 hours after a release. Fetched once, kept forever. */
export async function replayCandles(market: string, at: Date): Promise<{ candles: Candle[]; cached: boolean }> {
  const q = await db();
  const have = (await q`SELECT candles FROM mi_replay_cache WHERE market = ${market} AND at = ${at.toISOString()}`) as { candles: Candle[] }[];
  if (have[0]) return { candles: have[0].candles, cached: true };
  const sym = SYMBOLS.find((s) => s.key === market);
  if (!sym) throw new Error('Unknown market');
  const end = new Date(at.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  const all = await fetchTwelve(sym, '15min', 48, end);
  const candles = all.filter((c) => c.t >= at.getTime() - 3 * 3600000 && c.t <= at.getTime() + 9 * 3600000);
  if (candles.length >= 8) await q`INSERT INTO mi_replay_cache (market, at, candles) VALUES (${market}, ${at.toISOString()}, ${JSON.stringify(candles)}) ON CONFLICT DO NOTHING`;
  return { candles, cached: false };
}

export { replayStats } from './replaystats';
