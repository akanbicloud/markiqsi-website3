import type { Candle } from '../trading/indicators';

/** Pure stats for the replay panel (tested): move from the release candle's open after 15 min, 1 h and to the end, and the range. */
export function replayStats(candles: Candle[], atMs: number) {
  const i = candles.findIndex((c) => c.t >= atMs);
  if (i < 0) return null;
  const base = candles[i].o;
  const pct = (v: number) => Math.round(((v - base) / base) * 10000) / 100;
  const after = candles.slice(i);
  const at = (mins: number) => { const c = after.find((x) => x.t >= atMs + (mins - 15) * 60000); return c ? pct(c.c) : null; };
  return {
    index: i, base,
    m15: at(15), m60: at(60), end: pct(after[after.length - 1].c),
    high: pct(Math.max(...after.map((c) => c.h))), low: pct(Math.min(...after.map((c) => c.l))),
  };
}
