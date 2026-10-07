import { db } from '../db';
import type { Candle } from './indicators';
import { SYMBOLS, TIMEFRAMES, type Sym, type TF } from './symbols';

type Cached = { symbol: string; timeframe: string; candles: Candle[]; fetched_at: string; error: string | null };

async function fetchTwelve(sym: Sym, tf: TF, size: number): Promise<Candle[]> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error('TWELVE_DATA_API_KEY is not set');
  const u = new URL('https://api.twelvedata.com/time_series');
  u.searchParams.set('symbol', sym.td);
  u.searchParams.set('interval', tf);
  u.searchParams.set('outputsize', String(size));
  u.searchParams.set('timezone', 'UTC');
  u.searchParams.set('order', 'ASC');
  u.searchParams.set('apikey', key);
  const r = await fetch(u, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  const d = await r.json();
  if (d.status === 'error' || !Array.isArray(d.values)) throw new Error(d.message || `Price data error for ${sym.td}`);
  return (d.values as { datetime: string; open: string; high: string; low: string; close: string }[])
    .map((v) => ({ t: Date.parse(v.datetime.replace(' ', 'T') + (v.datetime.length > 10 ? 'Z' : 'T00:00:00Z')), o: +v.open, h: +v.high, l: +v.low, c: +v.close }))
    .filter((x) => Number.isFinite(x.t) && x.h >= x.l);
}

/** Drops the candle that is still forming, so all signals use finished candles only. */
export function closedOnly(c: Candle[], tf: TF, now = Date.now()) {
  const mins = TIMEFRAMES.find((x) => x.key === tf)!.minutes;
  if (c.length && c[c.length - 1].t + mins * 60000 > now) return c.slice(0, -1);
  return c;
}

export async function getCached(): Promise<Cached[]> {
  const q = await db();
  const rows = (await q`SELECT symbol, timeframe, candles, fetched_at, error FROM mq_price_cache`) as Cached[];
  return rows.map((r) => ({ ...r, fetched_at: String(r.fetched_at) }));
}

/**
 * Refreshes the oldest price series, at most `budget` per call, to stay inside the free
 * Twelve Data limit (8 requests a minute, 800 a day). Call it every 2 minutes.
 */
export async function refreshPrices(budget = 7) {
  const q = await db();
  const rows = (await q`SELECT symbol, timeframe, fetched_at FROM mq_price_cache`) as { symbol: string; timeframe: string; fetched_at: string }[];
  const last = new Map(rows.map((r) => [`${r.symbol}|${r.timeframe}`, new Date(r.fetched_at).getTime()]));
  const now = Date.now();
  const due: { sym: Sym; tf: TF; age: number }[] = [];
  for (const tf of TIMEFRAMES) {
    for (const sym of SYMBOLS) {
      const t = last.get(`${sym.key}|${tf.key}`);
      const age = t ? now - t : Infinity;
      if (age >= tf.refreshMinutes * 60000) due.push({ sym, tf: tf.key, age });
    }
  }
  due.sort((a, b) => b.age - a.age);
  const done: string[] = [];
  for (const d of due.slice(0, budget)) {
    try {
      const candles = await fetchTwelve(d.sym, d.tf, 300);
      await q`INSERT INTO mq_price_cache (symbol, timeframe, candles, fetched_at, error) VALUES (${d.sym.key}, ${d.tf}, ${JSON.stringify(candles)}, now(), NULL)
        ON CONFLICT (symbol, timeframe) DO UPDATE SET candles = EXCLUDED.candles, fetched_at = now(), error = NULL`;
      done.push(`${d.sym.key} ${d.tf}`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await q`INSERT INTO mq_price_cache (symbol, timeframe, candles, fetched_at, error) VALUES (${d.sym.key}, ${d.tf}, '[]'::jsonb, now(), ${msg})
        ON CONFLICT (symbol, timeframe) DO UPDATE SET fetched_at = now(), error = ${msg}`;
      done.push(`${d.sym.key} ${d.tf} (error: ${msg})`);
      if (/credits|limit/i.test(msg)) break;
    }
  }
  return { refreshed: done, waiting: Math.max(0, due.length - budget) };
}

/** Long history for backtests, cached for 12 hours. */
export async function getBacktestCandles(sym: Sym, tf: TF): Promise<Candle[]> {
  const q = await db();
  const key = `${tf}_bt`;
  const rows = (await q`SELECT candles, fetched_at FROM mq_price_cache WHERE symbol = ${sym.key} AND timeframe = ${key}`) as { candles: Candle[]; fetched_at: string }[];
  if (rows[0] && Date.now() - new Date(rows[0].fetched_at).getTime() < 12 * 3600000 && rows[0].candles.length) return rows[0].candles;
  const candles = await fetchTwelve(sym, tf, 5000);
  await q`INSERT INTO mq_price_cache (symbol, timeframe, candles, fetched_at) VALUES (${sym.key}, ${key}, ${JSON.stringify(candles)}, now())
    ON CONFLICT (symbol, timeframe) DO UPDATE SET candles = EXCLUDED.candles, fetched_at = now(), error = NULL`;
  return candles;
}

export function digitsFor(sym: Sym) {
  if (sym.pip >= 1) return 1;
  if (sym.pip >= 0.1) return 2;
  if (sym.pip >= 0.01) return sym.group === 'Forex' ? 3 : 2;
  return 5;
}
