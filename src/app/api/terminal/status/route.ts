import { db, hasDb, schemaWarnings } from '@/lib/db';
import { json, safeError } from '@/lib/http';
import { NEEDED } from '@/lib/terminal/pressure';
import { LEGS } from '@/lib/terminal/strength';

/** GET /api/terminal/status: what the Markets terminal has to work with (counts and yes/no only, no secrets). */
export async function GET() {
  const out: Record<string, unknown> = {
    database: hasDb(), price_data_key: !!process.env.TWELVE_DATA_API_KEY, gemini_key: !!process.env.GEMINI_API_KEY, cron_secret: !!process.env.CRON_SECRET,
  };
  if (!hasDb()) return json(out);
  try {
    const q = await db();
    const syms = Array.from(new Set([...NEEDED, ...Object.keys(LEGS)]));
    const cache = (await q`SELECT symbol, timeframe, jsonb_array_length(candles) AS n, fetched_at, error FROM mq_price_cache WHERE timeframe IN ('1h', '1day') AND symbol = ANY(${syms})`) as { symbol: string; timeframe: string; n: number; fetched_at: string; error: string | null }[];
    out.prices_1h = Object.fromEntries(syms.map((s) => { const r = cache.find((c) => c.symbol === s && c.timeframe === '1h'); return [s, r ? `${r.n} candles, updated ${new Date(r.fetched_at).toISOString().slice(0, 16)}${r.error ? `, error: ${r.error.slice(0, 80)}` : ''}` : 'missing']; }));
    out.prices_1day_ready = cache.filter((c) => c.timeframe === '1day' && c.n > 20).length + ' of ' + syms.length;
    const [c] = (await q`SELECT
      (SELECT count(*) FROM mi_events WHERE scheduled_at > now() - interval '2 days')::int AS events,
      (SELECT count(*) FROM mi_results)::int AS results,
      (SELECT count(*) FROM mi_reactions)::int AS reactions,
      (SELECT count(*) FROM mi_news WHERE published_at > now() - interval '4 days')::int AS news_recent,
      (SELECT count(*) FROM mi_news_tags)::int AS news_tagged,
      (SELECT count(*) FROM mi_cot)::int AS cot_rows,
      (SELECT count(*) FROM mi_replay_cache)::int AS replays_cached`) as Record<string, number>[];
    Object.assign(out, c);
    out.jobs = (await q`SELECT key, ok, note, last_success FROM mq_feed_state ORDER BY key`) as unknown[];
    const last = (await q`SELECT max(fetched_at) AS t FROM mq_price_cache`) as { t: string | null }[];
    out.last_price_refresh = last[0]?.t || null;
    if (schemaWarnings.length) out.schema_warnings = schemaWarnings;
  } catch (e) {
    out.error = safeError(e);
  }
  return json(out);
}
