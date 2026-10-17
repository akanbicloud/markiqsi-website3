import { db, hasDb } from '@/lib/db';
import { body, clientIp, fail, json, safeError, str } from '@/lib/http';
import { sha256 } from '@/lib/crypto';
import { getSession } from '@/lib/session';
import { chartData } from '@/lib/terminal/data';
import { candleFacts, explain } from '@/lib/terminal/why';
import { MARKETS } from '@/lib/terminal/pressure';

export const maxDuration = 30;
const ANON = 6;
const USER = 40;

/** POST { market, t }: why did this candle move? Facts are always free; the AI sentence counts against a daily limit. */
export async function POST(req: Request) {
  if (!hasDb()) return fail('Not connected', 503);
  const b = await body(req);
  const market = str(b.market, 12).toUpperCase();
  const t = Number(b.t);
  if (!MARKETS.some((m) => m.key === market) || !Number.isFinite(t)) return fail('Pick a candle first.');
  try {
    const d = await chartData(market, '1h', 400);
    if (!d) return fail('Price history for this market is still loading.', 503);
    const i = d.candles.findIndex((c) => c.t === t);
    if (i < 0) return fail('That candle is no longer on the chart. Reload the page.');
    const s = await getSession();
    const who = `why:${s ? `u:${s.uid}` : `ip:${sha256(clientIp(req) + (process.env.AUTH_SECRET || '')).slice(0, 32)}`}`;
    const q = await db();
    const used = (await q`INSERT INTO mq_ask_usage (who, day, count) VALUES (${who}, CURRENT_DATE, 1)
      ON CONFLICT (who, day) DO UPDATE SET count = mq_ask_usage.count + 1 RETURNING count`) as { count: number }[];
    const limit = s ? USER : ANON;
    if (used[0].count > limit) return json({ ok: true, ...candleFacts(d, i), ai: null, note: s ? 'You have used today’s AI explanations. The facts above still update.' : 'Create a free account for more AI explanations. The facts above are always free.' });
    return json({ ok: true, ...(await explain(d, i)) });
  } catch (e) {
    console.error('why', safeError(e));
    return fail('Could not explain this candle just now.', 500, safeError(e));
  }
}
