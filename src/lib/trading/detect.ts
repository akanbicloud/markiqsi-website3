import { atr, body, bear, bull, ema, highest, lowerWick, lowest, macd, rsi, swings, upperWick, type Candle } from './indicators';

export type Direction = 'Bullish' | 'Bearish';
export type Setup = { strategy: string; direction: Direction; strength: number; detail: string };

export type Ctx = {
  c: Candle[];
  L: number; // index of the last CLOSED candle
  atr: number[];
  closes: number[];
  digits: number;
};

export function makeCtx(c: Candle[], digits = 5): Ctx | null {
  if (c.length < 80) return null;
  return { c, L: c.length - 1, atr: atr(c, 14), closes: c.map((x) => x.c), digits };
}

const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)));
const fmt = (ctx: Ctx, n: number) => n.toFixed(ctx.digits);

function trend(ctx: Ctx): 'up' | 'down' | 'flat' {
  const e20 = ema(ctx.closes, 20)[ctx.L];
  const e50 = ema(ctx.closes, 50)[ctx.L];
  if (!(e20 > 0) || !(e50 > 0)) return 'flat';
  if (e20 > e50 && ctx.c[ctx.L].c > e50) return 'up';
  if (e20 < e50 && ctx.c[ctx.L].c < e50) return 'down';
  return 'flat';
}

// ---------- Classic indicators ----------

export function emaCross(ctx: Ctx, fast = 20, slow = 50): Setup | null {
  const f = ema(ctx.closes, fast);
  const s = ema(ctx.closes, slow);
  for (let k = ctx.L; k > ctx.L - 3; k--) {
    if (f[k - 1] <= s[k - 1] && f[k] > s[k]) {
      const st = 2 + (ctx.c[ctx.L].c > f[ctx.L] ? 1 : 0) + (s[ctx.L] > s[ctx.L - 5] ? 1 : 0);
      return { strategy: 'ema', direction: 'Bullish', strength: clamp(st), detail: `The ${fast} EMA crossed above the ${slow} EMA${k === ctx.L ? ' on the last candle' : ` ${ctx.L - k + 1} candles ago`}.` };
    }
    if (f[k - 1] >= s[k - 1] && f[k] < s[k]) {
      const st = 2 + (ctx.c[ctx.L].c < f[ctx.L] ? 1 : 0) + (s[ctx.L] < s[ctx.L - 5] ? 1 : 0);
      return { strategy: 'ema', direction: 'Bearish', strength: clamp(st), detail: `The ${fast} EMA crossed below the ${slow} EMA${k === ctx.L ? ' on the last candle' : ` ${ctx.L - k + 1} candles ago`}.` };
    }
  }
  return null;
}

export function rsiExtreme(ctx: Ctx): Setup | null {
  const r = rsi(ctx.closes, 14)[ctx.L];
  if (!(r >= 0)) return null;
  if (r < 30) return { strategy: 'rsi', direction: 'Bullish', strength: clamp(2 + (r < 25 ? 1 : 0) + (r < 20 ? 1 : 0)), detail: `RSI is oversold at ${r.toFixed(1)} (below 30).` };
  if (r > 70) return { strategy: 'rsi', direction: 'Bearish', strength: clamp(2 + (r > 75 ? 1 : 0) + (r > 80 ? 1 : 0)), detail: `RSI is overbought at ${r.toFixed(1)} (above 70).` };
  return null;
}

export function breakout(ctx: Ctx, n = 20): Setup | null {
  const { c, L } = ctx;
  const a = ctx.atr[L];
  for (let k = L; k > L - 2; k--) {
    const hi = highest(c, k - n, k - 1);
    const lo = lowest(c, k - n, k - 1);
    if (c[k].c > hi && c[k - 1].c <= highest(c, k - n - 1, k - 2)) {
      return { strategy: 'brk', direction: 'Bullish', strength: clamp(2 + ((c[k].c - hi) / a > 0.5 ? 1 : 0) + (trend(ctx) === 'up' ? 1 : 0)), detail: `Closed above its ${n}-candle high (${fmt(ctx, hi)}).` };
    }
    if (c[k].c < lo && c[k - 1].c >= lowest(c, k - n - 1, k - 2)) {
      return { strategy: 'brk', direction: 'Bearish', strength: clamp(2 + ((lo - c[k].c) / a > 0.5 ? 1 : 0) + (trend(ctx) === 'down' ? 1 : 0)), detail: `Closed below its ${n}-candle low (${fmt(ctx, lo)}).` };
    }
  }
  return null;
}

export function macdCross(ctx: Ctx): Setup | null {
  const m = macd(ctx.closes);
  for (let k = ctx.L; k > ctx.L - 2; k--) {
    if (m.line[k - 1] <= m.signal[k - 1] && m.line[k] > m.signal[k]) {
      return { strategy: 'macd', direction: 'Bullish', strength: clamp(2 + (m.line[k] > 0 ? 1 : 0)), detail: `The MACD line crossed above its signal line${m.line[k] < 0 ? ' below zero' : ''}.` };
    }
    if (m.line[k - 1] >= m.signal[k - 1] && m.line[k] < m.signal[k]) {
      return { strategy: 'macd', direction: 'Bearish', strength: clamp(2 + (m.line[k] < 0 ? 1 : 0)), detail: `The MACD line crossed below its signal line${m.line[k] > 0 ? ' above zero' : ''}.` };
    }
  }
  return null;
}

// ---------- Price action ----------

export function candlePattern(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const a = ctx.atr[L];
  const x = c[L];
  const p = c[L - 1];
  const pp = c[L - 2];
  const tr = trend(ctx);
  // Morning / evening star
  if (bear(pp) && body(pp) > 0.6 * a && body(p) < 0.35 * body(pp) && bull(x) && x.c > (pp.o + pp.c) / 2) {
    return { strategy: 'candles', direction: 'Bullish', strength: clamp(4), detail: 'Morning star: a three-candle bullish reversal pattern.' };
  }
  if (bull(pp) && body(pp) > 0.6 * a && body(p) < 0.35 * body(pp) && bear(x) && x.c < (pp.o + pp.c) / 2) {
    return { strategy: 'candles', direction: 'Bearish', strength: clamp(4), detail: 'Evening star: a three-candle bearish reversal pattern.' };
  }
  // Engulfing
  if (bear(p) && bull(x) && x.o <= p.c && x.c >= p.o && body(x) > body(p) && body(x) > 0.4 * a) {
    return { strategy: 'candles', direction: 'Bullish', strength: clamp(3 + (tr === 'down' ? 0 : 1)), detail: 'Bullish engulfing candle.' };
  }
  if (bull(p) && bear(x) && x.o >= p.c && x.c <= p.o && body(x) > body(p) && body(x) > 0.4 * a) {
    return { strategy: 'candles', direction: 'Bearish', strength: clamp(3 + (tr === 'up' ? 0 : 1)), detail: 'Bearish engulfing candle.' };
  }
  // Pin bars (hammer / shooting star)
  const range = x.h - x.l;
  if (range > 0.6 * a) {
    if (lowerWick(x) >= 2 * body(x) && upperWick(x) <= 0.3 * range && lowerWick(x) >= 0.55 * range) {
      return { strategy: 'candles', direction: 'Bullish', strength: clamp(2 + (x.l <= lowest(c, L - 10, L - 1) ? 1 : 0)), detail: 'Hammer (bullish pin bar): buyers pushed price back up from the low.' };
    }
    if (upperWick(x) >= 2 * body(x) && lowerWick(x) <= 0.3 * range && upperWick(x) >= 0.55 * range) {
      return { strategy: 'candles', direction: 'Bearish', strength: clamp(2 + (x.h >= highest(c, L - 10, L - 1) ? 1 : 0)), detail: 'Shooting star (bearish pin bar): sellers pushed price back down from the high.' };
    }
  }
  // Inside bar in a trend
  if (x.h < p.h && x.l > p.l && tr !== 'flat') {
    return { strategy: 'candles', direction: tr === 'up' ? 'Bullish' : 'Bearish', strength: 2, detail: `Inside bar in ${tr === 'up' ? 'an uptrend' : 'a downtrend'}: price is pausing before its next move.` };
  }
  return null;
}

export function supportResistance(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const a = ctx.atr[L];
  const sw = swings(c, 3, L - 200, L - 4);
  const tol = 0.2 * a;
  const levels: { price: number; touches: number; last: number }[] = [];
  for (const s of sw) {
    const lv = levels.find((v) => Math.abs(v.price - s.price) <= tol);
    if (lv) {
      lv.price = (lv.price * lv.touches + s.price) / (lv.touches + 1);
      lv.touches++;
      lv.last = Math.max(lv.last, s.i);
    } else levels.push({ price: s.price, touches: 1, last: s.i });
  }
  const x = c[L];
  let best: { price: number; touches: number; dist: number } | null = null;
  for (const v of levels) {
    if (v.touches < 2) continue;
    // a real level should hold: few candles have closed straight through it recently
    let crosses = 0;
    for (let j = Math.max(1, L - 100); j < L; j++) if ((c[j - 1].c - v.price) * (c[j].c - v.price) < 0) crosses++;
    if (crosses > 4) continue;
    const touching = x.l <= v.price + 0.15 * a && x.h >= v.price - 0.15 * a;
    const near = Math.abs(x.c - v.price);
    if (touching && near <= 0.6 * a && (!best || near < best.dist)) best = { price: v.price, touches: v.touches, dist: near };
  }
  if (!best) return null;
  if (x.c >= best.price) {
    return { strategy: 'sr', direction: 'Bullish', strength: clamp(2 + Math.min(2, best.touches - 2) + (x.c > x.o ? 1 : 0)), detail: `Testing support at ${fmt(ctx, best.price)}, a level price has turned at ${best.touches} times.` };
  }
  return { strategy: 'sr', direction: 'Bearish', strength: clamp(2 + Math.min(2, best.touches - 2) + (x.c < x.o ? 1 : 0)), detail: `Testing resistance at ${fmt(ctx, best.price)}, a level price has turned at ${best.touches} times.` };
}

export function supplyDemand(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const x = c[L];
  for (let k = L - 4; k >= Math.max(20, L - 150); k--) {
    const a = ctx.atr[k + 1];
    if (!(a > 0)) continue;
    const base = c[k];
    const imp = c[k + 1];
    const move2 = Math.abs(c[Math.min(k + 2, L - 1)].c - base.c);
    const strong = body(imp) >= 1.8 * a || move2 >= 2.5 * a;
    if (!strong || body(base) > 0.6 * a) continue;
    if (bull(imp) && imp.c > base.h) {
      const top = Math.max(base.o, base.c);
      const bot = base.l;
      let fresh = true;
      for (let j = k + 2; j < L; j++) if (c[j].l <= top) { fresh = false; break; }
      if (fresh && x.l <= top && x.c >= bot) {
        return { strategy: 'sd', direction: 'Bullish', strength: clamp(3 + (body(imp) >= 2.5 * a ? 1 : 0) + (x.c > x.o ? 1 : 0)), detail: `Price is back in a fresh demand zone (${fmt(ctx, bot)}–${fmt(ctx, top)}) where a strong rally started ${L - k} candles ago.` };
      }
    }
    if (bear(imp) && imp.c < base.l) {
      const bot = Math.min(base.o, base.c);
      const top = base.h;
      let fresh = true;
      for (let j = k + 2; j < L; j++) if (c[j].h >= bot) { fresh = false; break; }
      if (fresh && x.h >= bot && x.c <= top) {
        return { strategy: 'sd', direction: 'Bearish', strength: clamp(3 + (body(imp) >= 2.5 * a ? 1 : 0) + (x.c < x.o ? 1 : 0)), detail: `Price is back in a fresh supply zone (${fmt(ctx, bot)}–${fmt(ctx, top)}) where a strong drop started ${L - k} candles ago.` };
      }
    }
  }
  return null;
}

// ---------- ICT & SMC ----------

export function fairValueGap(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const x = c[L];
  for (let m = L - 2; m >= Math.max(2, L - 60); m--) {
    const a = ctx.atr[m];
    if (!(a > 0)) continue;
    const before = c[m - 1];
    const after = c[m + 1];
    if (after.l > before.h && after.l - before.h >= 0.3 * a) {
      const bot = before.h;
      const top = after.l;
      let filled = false;
      for (let j = m + 2; j < L; j++) if (c[j].l <= bot) { filled = true; break; }
      let touched = false;
      for (let j = m + 2; j < L; j++) if (c[j].l <= top) { touched = true; break; }
      if (!filled && !touched && x.l <= top && x.c >= bot) {
        return { strategy: 'fvg', direction: 'Bullish', strength: clamp(3 + ((top - bot) / a > 0.8 ? 1 : 0) + (trend(ctx) === 'up' ? 1 : 0)), detail: `Price is trading into a bullish fair value gap (${fmt(ctx, bot)}–${fmt(ctx, top)}).` };
      }
    }
    if (after.h < before.l && before.l - after.h >= 0.3 * a) {
      const top = before.l;
      const bot = after.h;
      let filled = false;
      for (let j = m + 2; j < L; j++) if (c[j].h >= top) { filled = true; break; }
      let touched = false;
      for (let j = m + 2; j < L; j++) if (c[j].h >= bot) { touched = true; break; }
      if (!filled && !touched && x.h >= bot && x.c <= top) {
        return { strategy: 'fvg', direction: 'Bearish', strength: clamp(3 + ((top - bot) / a > 0.8 ? 1 : 0) + (trend(ctx) === 'down' ? 1 : 0)), detail: `Price is trading into a bearish fair value gap (${fmt(ctx, bot)}–${fmt(ctx, top)}).` };
      }
    }
  }
  return null;
}

export function orderBlock(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const x = c[L];
  for (let k = L - 4; k >= Math.max(15, L - 100); k--) {
    const ob = c[k];
    const prevHigh = highest(c, k - 10, k);
    const prevLow = lowest(c, k - 10, k);
    if (bear(ob)) {
      let broke = -1;
      for (let j = k + 1; j <= Math.min(k + 3, L - 1); j++) if (c[j].c > prevHigh) { broke = j; break; }
      if (broke > 0) {
        let tapped = false;
        for (let j = broke + 1; j < L; j++) if (c[j].l <= ob.h) { tapped = true; break; }
        if (!tapped && x.l <= ob.h && x.c >= ob.l) {
          return { strategy: 'ob', direction: 'Bullish', strength: clamp(3 + (trend(ctx) === 'up' ? 1 : 0) + (x.c > x.o ? 1 : 0)), detail: `Price is back at a bullish order block (${fmt(ctx, ob.l)}–${fmt(ctx, ob.h)}) left before a break of structure.` };
        }
      }
    }
    if (bull(ob)) {
      let broke = -1;
      for (let j = k + 1; j <= Math.min(k + 3, L - 1); j++) if (c[j].c < prevLow) { broke = j; break; }
      if (broke > 0) {
        let tapped = false;
        for (let j = broke + 1; j < L; j++) if (c[j].h >= ob.l) { tapped = true; break; }
        if (!tapped && x.h >= ob.l && x.c <= ob.h) {
          return { strategy: 'ob', direction: 'Bearish', strength: clamp(3 + (trend(ctx) === 'down' ? 1 : 0) + (x.c < x.o ? 1 : 0)), detail: `Price is back at a bearish order block (${fmt(ctx, ob.l)}–${fmt(ctx, ob.h)}) left before a break of structure.` };
        }
      }
    }
  }
  return null;
}

export function structureBreak(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const sw = swings(c, 2, L - 150, L - 1);
  const highs = sw.filter((s) => s.type === 'H');
  const lows = sw.filter((s) => s.type === 'L');
  if (highs.length < 2 || lows.length < 2) return null;
  const h1 = highs[highs.length - 1];
  const h0 = highs[highs.length - 2];
  const l1 = lows[lows.length - 1];
  const l0 = lows[lows.length - 2];
  const x = c[L];
  const p = c[L - 1];
  if (x.c > h1.price && p.c <= h1.price) {
    const wasDown = h1.price < h0.price && l1.price < l0.price;
    return { strategy: 'bos', direction: 'Bullish', strength: clamp(wasDown ? 4 : 3), detail: wasDown ? `Change of character (CHoCH): price broke above the last lower high at ${fmt(ctx, h1.price)}, a sign the downtrend may be ending.` : `Break of structure (BOS) to the upside above ${fmt(ctx, h1.price)}.` };
  }
  if (x.c < l1.price && p.c >= l1.price) {
    const wasUp = h1.price > h0.price && l1.price > l0.price;
    return { strategy: 'bos', direction: 'Bearish', strength: clamp(wasUp ? 4 : 3), detail: wasUp ? `Change of character (CHoCH): price broke below the last higher low at ${fmt(ctx, l1.price)}, a sign the uptrend may be ending.` : `Break of structure (BOS) to the downside below ${fmt(ctx, l1.price)}.` };
  }
  return null;
}

export function liquiditySweep(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const sw = swings(c, 2, L - 40, L - 3);
  const x = c[L];
  const highs = sw.filter((s) => s.type === 'H').sort((a, b) => b.price - a.price);
  const lows = sw.filter((s) => s.type === 'L').sort((a, b) => a.price - b.price);
  for (const h of highs) {
    let untouched = true;
    for (let j = h.i + 1; j < L; j++) if (c[j].h > h.price) { untouched = false; break; }
    if (untouched && x.h > h.price && x.c < h.price) {
      return { strategy: 'liq', direction: 'Bearish', strength: clamp(3 + (upperWick(x) > body(x) ? 1 : 0)), detail: `Swept the liquidity above the old high at ${fmt(ctx, h.price)}, then closed back below it.` };
    }
  }
  for (const l of lows) {
    let untouched = true;
    for (let j = l.i + 1; j < L; j++) if (c[j].l < l.price) { untouched = false; break; }
    if (untouched && x.l < l.price && x.c > l.price) {
      return { strategy: 'liq', direction: 'Bullish', strength: clamp(3 + (lowerWick(x) > body(x) ? 1 : 0)), detail: `Swept the liquidity below the old low at ${fmt(ctx, l.price)}, then closed back above it.` };
    }
  }
  return null;
}

export function optimalTradeEntry(ctx: Ctx): Setup | null {
  const { c, L } = ctx;
  const sw = swings(c, 2, L - 80, L - 1);
  if (sw.length < 2) return null;
  const a = ctx.atr[L];
  const x = c[L];
  const last = sw[sw.length - 1];
  const prev = [...sw].reverse().find((s) => s.type !== last.type);
  if (!prev) return null;
  if (prev.type === 'L' && last.type === 'H' && last.price - prev.price >= 3 * a) {
    const leg = last.price - prev.price;
    if (lowest(c, last.i + 1, L) < prev.price) return null;
    const r = (last.price - x.c) / leg;
    if (r >= 0.62 && r <= 0.79) {
      return { strategy: 'ote', direction: 'Bullish', strength: clamp(3 + (trend(ctx) === 'up' ? 1 : 0)), detail: `Pulled back ${Math.round(r * 100)}% of the last up-leg, into the OTE zone (62–79%).` };
    }
  }
  if (prev.type === 'H' && last.type === 'L' && prev.price - last.price >= 3 * a) {
    const leg = prev.price - last.price;
    if (highest(c, last.i + 1, L) > prev.price) return null;
    const r = (x.c - last.price) / leg;
    if (r >= 0.62 && r <= 0.79) {
      return { strategy: 'ote', direction: 'Bearish', strength: clamp(3 + (trend(ctx) === 'down' ? 1 : 0)), detail: `Pulled back ${Math.round(r * 100)}% of the last down-leg, into the OTE zone (62–79%).` };
    }
  }
  return null;
}

export const DETECTORS: Record<string, (ctx: Ctx) => Setup | null> = {
  sd: supplyDemand,
  sr: supportResistance,
  candles: candlePattern,
  fvg: fairValueGap,
  ob: orderBlock,
  bos: structureBreak,
  liq: liquiditySweep,
  ote: optimalTradeEntry,
  ema: (ctx) => emaCross(ctx, 20, 50),
  rsi: rsiExtreme,
  brk: (ctx) => breakout(ctx, 20),
  macd: macdCross,
};

export function runAll(c: Candle[], digits: number, strategies = Object.keys(DETECTORS)): Setup[] {
  const ctx = makeCtx(c, digits);
  if (!ctx) return [];
  const out: Setup[] = [];
  for (const k of strategies) {
    const d = DETECTORS[k];
    if (!d) continue;
    try {
      const s = d(ctx);
      if (s) out.push(s);
    } catch {
      // ignore a single detector failing
    }
  }
  return out;
}
