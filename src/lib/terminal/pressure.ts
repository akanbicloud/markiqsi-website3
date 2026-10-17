import type { Candle } from '../trading/indicators';

/**
 * MarkIQ Pressure: how strongly the markets that usually drive a market are pushing it up (+) or
 * down (−) on each candle, from −100 to +100. It uses real price moves of linked markets (the US
 * dollar against the majors, oil, stocks, Bitcoin, gold), not order data, and is fixed once a
 * candle closes. Every number comes from real candles.
 */

export type Driver = { key: string; label: string; weight: number };
export type Market = { key: string; label: string; drivers: Driver[] };

// For each market, the linked markets and which way they usually push it (+ same way, − opposite).
export const MARKETS: Market[] = [
  { key: 'XAUUSD', label: 'Gold', drivers: [
    { key: 'USD', label: 'US dollar', weight: -1 }, { key: 'WTI', label: 'Oil', weight: 0.3 },
    { key: 'BTCUSD', label: 'Bitcoin', weight: 0.25 }, { key: 'SPY', label: 'Stocks', weight: -0.3 },
  ] },
  { key: 'EURUSD', label: 'EUR/USD', drivers: [
    { key: 'USD-EUR', label: 'US dollar', weight: -1 }, { key: 'SPY', label: 'Stocks', weight: 0.2 }, { key: 'XAUUSD', label: 'Gold', weight: 0.15 },
  ] },
  { key: 'GBPUSD', label: 'GBP/USD', drivers: [
    { key: 'USD-GBP', label: 'US dollar', weight: -1 }, { key: 'SPY', label: 'Stocks', weight: 0.25 },
  ] },
  { key: 'USDJPY', label: 'USD/JPY', drivers: [
    { key: 'USD-JPY', label: 'US dollar', weight: 1 }, { key: 'SPY', label: 'Stocks', weight: 0.4 }, { key: 'XAUUSD', label: 'Gold', weight: -0.2 },
  ] },
  { key: 'SPY', label: 'S&P 500', drivers: [
    { key: 'QQQ', label: 'Tech stocks', weight: 0.6 }, { key: 'BTCUSD', label: 'Bitcoin', weight: 0.3 },
    { key: 'USD', label: 'US dollar', weight: -0.3 }, { key: 'WTI', label: 'Oil', weight: -0.15 },
  ] },
  { key: 'BTCUSD', label: 'Bitcoin', drivers: [
    { key: 'SPY', label: 'Stocks', weight: 0.6 }, { key: 'USD', label: 'US dollar', weight: -0.4 }, { key: 'XAUUSD', label: 'Gold', weight: 0.2 },
  ] },
];

// The US dollar is read from the majors: +1 when the dollar rises against them.
const USD_LEGS: [string, number][] = [['EURUSD', -1], ['GBPUSD', -1], ['USDJPY', 1], ['AUDUSD', -1], ['USDCAD', 1], ['USDCHF', 1]];

export const NEEDED = Array.from(new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'XAUUSD', 'WTI', 'SPY', 'QQQ', 'BTCUSD']));

export type PressurePoint = { score: number | null; parts: { label: string; value: number }[] };

/** Log return per candle time, for every symbol. */
// Markets stamp candles differently (US stocks open at :30, forex at :00), so times are matched by bucket.
function returnsBy(c: Candle[], bucket: number): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 1; i < c.length; i++) if (c[i - 1].c > 0 && c[i].c > 0) m.set(Math.floor(c[i].t / bucket), Math.log(c[i].c / c[i - 1].c));
  return m;
}

function bucketOf(c: Candle[]): number {
  let best = Infinity;
  for (let i = 1; i < c.length; i++) { const d = c[i].t - c[i - 1].t; if (d >= 60000 && d < best) best = d; }
  return Number.isFinite(best) ? best : 3600000;
}

function driverReturns(key: string, rets: Record<string, Map<number, number>>, t: number): number | null {
  if (key === 'USD' || key.startsWith('USD-')) {
    const skip = key.split('-')[1];
    const legs = USD_LEGS.filter(([s]) => !skip || !s.includes(skip));
    const vals = legs.map(([s, sign]) => { const r = rets[s]?.get(t); return r == null ? null : r * sign; }).filter((v): v is number => v != null);
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  const r = rets[key]?.get(t);
  return r == null ? null : r;
}

/** Rolling standard deviation of a series (by index), for z-scores. */
function rollingStd(vals: (number | null)[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < vals.length; i++) {
    const w = vals.slice(Math.max(0, i - n), i).filter((v): v is number => v != null);
    if (w.length < 20) { out.push(null); continue; }
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
    out.push(sd > 0 ? sd : null);
  }
  return out;
}

/**
 * Pressure for each candle of `target`. `all` holds candles for the drivers (same timeframe).
 * A candle gets a score only when at least half of its drivers have a price for that time.
 */
export function pressure(marketKey: string, target: Candle[], all: Record<string, Candle[]>): PressurePoint[] {
  const m = MARKETS.find((x) => x.key === marketKey);
  if (!m) return target.map(() => ({ score: null, parts: [] }));
  const rets: Record<string, Map<number, number>> = {};
  const bucket = bucketOf(target);
  for (const [k, c] of Object.entries(all)) rets[k] = returnsBy(c, bucket);
  const series = m.drivers.map((d) => target.map((x) => driverReturns(d.key, rets, Math.floor(x.t / bucket))));
  const sds = series.map((s) => rollingStd(s, 100));
  const totalW = m.drivers.reduce((a, d) => a + Math.abs(d.weight), 0);
  const raw = target.map((_, i) => {
    const parts: { label: string; value: number }[] = [];
    let sum = 0, used = 0;
    m.drivers.forEach((d, j) => {
      const r = series[j][i], sd = sds[j][i];
      if (r == null || sd == null) return;
      const z = Math.max(-4, Math.min(4, r / sd));
      sum += z * d.weight;
      used += Math.abs(d.weight);
      parts.push({ label: d.label, value: Math.round(Math.tanh((z * d.weight) / 1.5) * 100) }); // + pushes this market up
    });
    if (used < totalW / 2) return { score: null, parts: [] };
    return { score: sum / used, parts };
  });
  // light smoothing so one noisy hour does not flip the band
  let prev: number | null = null;
  return raw.map((p) => {
    if (p.score == null) { prev = null; return p; }
    const s: number = prev == null ? p.score : prev * 0.4 + p.score * 0.6;
    prev = s;
    return { score: Math.round(Math.tanh(s / 1.2) * 100), parts: p.parts };
  });
}
