import { atr, ema, rsi, swings, type Candle } from './indicators';
import { DETECTORS, at, makeCtx } from './detect';

/**
 * Market structure from REAL price data (never from the screenshot), so every level the
 * chart analysis mentions is a real price. All values use closed candles only.
 */
export type StructureSummary = {
  lastClose: number;
  lastTime: string;
  trend: { bias: 'up' | 'down' | 'sideways'; ema20: number; ema50: number; ema200: number | null; aboveEma200: boolean | null };
  structure: string;
  swings: { type: 'high' | 'low'; price: number; candlesAgo: number }[];
  resistance: number[];
  support: number[];
  range20: { high: number; low: number };
  atr14: number;
  rsi14: number;
  recentSetups: { strategy: string; direction: string; detail: string; candlesAgo: number }[];
};

const r = (n: number, d: number) => Number(n.toFixed(d));

export function analyzeStructure(c: Candle[], digits: number): StructureSummary | null {
  if (c.length < 120) return null;
  const L = c.length - 1;
  const closes = c.map((x) => x.c);
  const e20 = ema(closes, 20)[L];
  const e50 = ema(closes, 50)[L];
  const e200v = c.length >= 200 ? ema(closes, 200)[L] : NaN;
  const last = c[L].c;
  const bias: StructureSummary['trend']['bias'] = e20 > e50 && last > e50 ? 'up' : e20 < e50 && last < e50 ? 'down' : 'sideways';

  const sw = swings(c, 3, Math.max(0, L - 250), L);
  const highs = sw.filter((s) => s.type === 'H');
  const lows = sw.filter((s) => s.type === 'L');
  const h2 = highs.slice(-2);
  const l2 = lows.slice(-2);
  let structure = 'Mixed: no clear sequence of higher or lower swings';
  if (h2.length === 2 && l2.length === 2) {
    if (h2[1].price > h2[0].price && l2[1].price > l2[0].price) structure = 'Higher highs and higher lows (bullish structure)';
    else if (h2[1].price < h2[0].price && l2[1].price < l2[0].price) structure = 'Lower highs and lower lows (bearish structure)';
    else if (h2[1].price < h2[0].price && l2[1].price > l2[0].price) structure = 'Lower highs and higher lows (price is squeezing into a range)';
    else structure = 'Higher highs and lower lows (wide, volatile range)';
  }

  const uniq = (arr: number[]) => arr.filter((v, i) => arr.findIndex((w) => Math.abs(w - v) < (atr(c, 14)[L] || 0) * 0.3) === i);
  const resistance = uniq(highs.map((s) => s.price).filter((p) => p > last).sort((a, b) => a - b)).slice(0, 3).map((p) => r(p, digits));
  const support = uniq(lows.map((s) => s.price).filter((p) => p < last).sort((a, b) => b - a)).slice(0, 3).map((p) => r(p, digits));

  const recentSetups: StructureSummary['recentSetups'] = [];
  const ctx = makeCtx(c, digits);
  if (ctx) {
    for (let k = L; k >= Math.max(80, L - 30) && recentSetups.length < 8; k--) {
      for (const d of Object.values(DETECTORS)) {
        try {
          const s = d(at(ctx, k));
          if (s && !recentSetups.some((x) => x.strategy === s.strategy)) recentSetups.push({ strategy: s.strategy, direction: s.direction, detail: s.detail, candlesAgo: L - k });
        } catch {
          // one detector failing should not stop the others
        }
      }
    }
  }
  const win = c.slice(-20);
  return {
    lastClose: r(last, digits),
    lastTime: new Date(c[L].t).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    trend: { bias, ema20: r(e20, digits), ema50: r(e50, digits), ema200: Number.isFinite(e200v) ? r(e200v, digits) : null, aboveEma200: Number.isFinite(e200v) ? last > e200v : null },
    structure,
    swings: sw.slice(-6).map((s) => ({ type: s.type === 'H' ? 'high' : 'low', price: r(s.price, digits), candlesAgo: L - s.i })),
    resistance,
    support,
    range20: { high: r(Math.max(...win.map((x) => x.h)), digits), low: r(Math.min(...win.map((x) => x.l)), digits) },
    atr14: r(atr(c, 14)[L] || 0, digits),
    rsi14: Math.round(rsi(closes, 14)[L] || 0),
    recentSetups,
  };
}
