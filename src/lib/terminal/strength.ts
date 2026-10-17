import type { Candle } from '../trading/indicators';

/**
 * Currency strength from the US-dollar pairs: each currency's % change against the dollar, then the
 * average of all eight is taken away, so + means stronger than the group and − weaker.
 */

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const;
// pair -> (currency, sign): EURUSD up = EUR stronger; USDJPY up = JPY weaker
export const LEGS: Record<string, [string, number]> = { EURUSD: ['EUR', 1], GBPUSD: ['GBP', 1], AUDUSD: ['AUD', 1], NZDUSD: ['NZD', 1], USDJPY: ['JPY', -1], USDCAD: ['CAD', -1], USDCHF: ['CHF', -1] };

export type Period = { key: string; label: string; tf: '1h' | '1day'; from: (now: number) => number };
export const PERIODS: Period[] = [
  { key: 'today', label: 'Today', tf: '1h', from: (now) => Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()) },
  { key: '24h', label: '24 hours', tf: '1h', from: (now) => now - 24 * 3600000 },
  { key: 'week', label: '1 week', tf: '1day', from: (now) => now - 7 * 86400000 },
  { key: 'month', label: '1 month', tf: '1day', from: (now) => now - 30 * 86400000 },
];

/** % change from the last close before `from` to the latest close. */
function change(c: Candle[], from: number): number | null {
  if (c.length < 2) return null;
  let base: Candle | null = null;
  for (const x of c) { if (x.t <= from) base = x; else break; }
  if (!base) base = c[0].t <= from + 2 * 86400000 ? c[0] : null;
  const last = c[c.length - 1];
  if (!base || base === last || !base.c) return null;
  return ((last.c - base.c) / base.c) * 100;
}

/** Pure (tested). Returns null when fewer than 5 pairs have data. */
export function strength(candles: Record<string, Candle[]>, from: number): Record<string, number> | null {
  const raw: Record<string, number> = { USD: 0 };
  let n = 0;
  for (const [pair, [cur, sign]] of Object.entries(LEGS)) {
    const ch = change(candles[pair] || [], from);
    if (ch == null) continue;
    // for USDXXX, the currency's change vs USD is the inverse move
    raw[cur] = sign > 0 ? ch : (100 / (1 + ch / 100) - 100);
    n++;
  }
  if (n < 5) return null;
  const keys = Object.keys(raw);
  const mean = keys.reduce((a, k) => a + raw[k], 0) / keys.length;
  return Object.fromEntries(keys.map((k) => [k, Math.round((raw[k] - mean) * 100) / 100]));
}

/** Hourly strength path over the last `hours` for a small line chart (tested via strength()). */
export function strengthPath(candles: Record<string, Candle[]>, hours = 48, now = Date.now()) {
  const from = now - hours * 3600000;
  const times = (candles.EURUSD || []).map((c) => c.t).filter((t) => t >= from);
  return times.map((t) => {
    const cut = Object.fromEntries(Object.entries(candles).map(([k, c]) => [k, c.filter((x) => x.t <= t)]));
    return { t, s: strength(cut, from) };
  }).filter((p) => p.s);
}
