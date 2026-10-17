import { hasDb } from '@/lib/db';
import { fail, json, safeError } from '@/lib/http';
import { replayCandles, replayEvents } from '@/lib/terminal/replay';
import { MARKETS } from '@/lib/terminal/pressure';
import { quotaMessage, refundQuota, takeQuota } from '@/lib/usage';
import { db } from '@/lib/db';

export const maxDuration = 30;

/** GET ?market=EURUSD&at=<release time>: 15-minute candles around a past release (only releases we have on record). */
export async function GET(req: Request) {
  if (!hasDb()) return fail('Not connected', 503);
  const u = new URL(req.url);
  const market = (u.searchParams.get('market') || '').toUpperCase();
  const at = new Date(u.searchParams.get('at') || '');
  if (!MARKETS.some((m) => m.key === market) || !Number.isFinite(at.getTime())) return fail('Pick a market and a release.');
  try {
    const known = (await replayEvents()).some((e) => e.at === at.toISOString());
    if (!known) return fail('That release is not on record.', 404);
    const q = await db();
    const cached = (await q`SELECT 1 FROM mi_replay_cache WHERE market = ${market} AND at = ${at.toISOString()}`) as unknown[];
    if (!cached.length) {
      const quota = await takeQuota(req, 'replay');
      if (!quota.ok) return fail(quotaMessage(quota, 'new replays'), 429);
    }
    try {
      const r = await replayCandles(market, at);
      if (r.candles.length < 8) return fail('There is not enough price data around this release (the market may have been closed).', 404);
      return json({ ok: true, market, at: at.toISOString(), ...r });
    } catch (e) {
      if (!cached.length) await refundQuota(req, 'replay');
      throw e;
    }
  } catch (e) {
    console.error('replay', safeError(e));
    return fail(/credits/i.test((e as Error).message) ? 'Price data is busy right now. Try again in a minute.' : 'Could not load this replay.', 503, safeError(e));
  }
}
