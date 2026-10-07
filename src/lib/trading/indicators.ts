export type Candle = { t: number; o: number; h: number; l: number; c: number };

export function ema(values: number[], n: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length < n) return out;
  let s = 0;
  for (let i = 0; i < n; i++) s += values[i];
  let prev = s / n;
  out[n - 1] = prev;
  const k = 2 / (n + 1);
  for (let i = n; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values: number[], n: number): number[] {
  const out = new Array(values.length).fill(NaN);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    if (i >= n) s -= values[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

export function rsi(values: number[], n = 14): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length <= n) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  g /= n;
  l /= n;
  out[n] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line = values.map((_, i) => f[i] - s[i]);
  const start = line.findIndex((v) => !Number.isNaN(v));
  const sig = new Array(values.length).fill(NaN);
  if (start >= 0) {
    const part = ema(line.slice(start), signal);
    for (let i = 0; i < part.length; i++) sig[start + i] = part[i];
  }
  return { line, signal: sig };
}

export function atr(c: Candle[], n = 14): number[] {
  const out = new Array(c.length).fill(NaN);
  if (c.length <= n) return out;
  const tr = c.map((x, i) => (i === 0 ? x.h - x.l : Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c))));
  let a = 0;
  for (let i = 1; i <= n; i++) a += tr[i];
  a /= n;
  out[n] = a;
  for (let i = n + 1; i < c.length; i++) {
    a = (a * (n - 1) + tr[i]) / n;
    out[i] = a;
  }
  return out;
}

export function highest(c: Candle[], from: number, to: number) {
  let m = -Infinity;
  for (let i = Math.max(0, from); i <= to; i++) m = Math.max(m, c[i].h);
  return m;
}

export function lowest(c: Candle[], from: number, to: number) {
  let m = Infinity;
  for (let i = Math.max(0, from); i <= to; i++) m = Math.min(m, c[i].l);
  return m;
}

export type Swing = { i: number; price: number; type: 'H' | 'L' };

/** Fractal swing points. A swing at i needs `side` bars on each side, so the last `side` bars cannot be swings yet. */
export function swings(c: Candle[], side = 2, from = 0, to = c.length - 1): Swing[] {
  const out: Swing[] = [];
  for (let i = Math.max(side, from); i <= Math.min(to, c.length - 1 - side); i++) {
    let hi = true;
    let lo = true;
    for (let k = 1; k <= side; k++) {
      if (!(c[i].h > c[i - k].h && c[i].h >= c[i + k].h)) hi = false;
      if (!(c[i].l < c[i - k].l && c[i].l <= c[i + k].l)) lo = false;
    }
    if (hi) out.push({ i, price: c[i].h, type: 'H' });
    if (lo) out.push({ i, price: c[i].l, type: 'L' });
  }
  return out;
}

export const body = (x: Candle) => Math.abs(x.c - x.o);
export const bull = (x: Candle) => x.c > x.o;
export const bear = (x: Candle) => x.c < x.o;
export const upperWick = (x: Candle) => x.h - Math.max(x.o, x.c);
export const lowerWick = (x: Candle) => Math.min(x.o, x.c) - x.l;

export function stdev(values: number[], n: number): number[] {
  const m = sma(values, n);
  return values.map((_, i) => {
    if (i < n - 1) return NaN;
    let s = 0;
    for (let k = i - n + 1; k <= i; k++) s += (values[k] - m[i]) ** 2;
    return Math.sqrt(s / n);
  });
}

/** Slow stochastic: %K smoothed by `smooth`, %D = SMA of %K. */
export function stochastic(c: Candle[], kLen = 14, dLen = 3, smooth = 3) {
  const raw = c.map((x, i) => {
    if (i < kLen - 1) return NaN;
    const hh = highest(c, i - kLen + 1, i);
    const ll = lowest(c, i - kLen + 1, i);
    return hh === ll ? 50 : ((x.c - ll) / (hh - ll)) * 100;
  });
  const fill = (arr: number[]) => arr.map((v) => (Number.isNaN(v) ? 0 : v));
  const k = sma(fill(raw), smooth).map((v, i) => (i < kLen + smooth - 2 ? NaN : v));
  const d = sma(fill(k), dLen).map((v, i) => (i < kLen + smooth + dLen - 3 ? NaN : v));
  return { k, d };
}

/** Supertrend: dir[i] = 1 (up) or -1 (down). Uses Wilder ATR like TradingView. */
export function supertrend(c: Candle[], period = 10, mult = 3) {
  const a = atr(c, period);
  const dir = new Array(c.length).fill(0);
  let up = NaN;
  let dn = NaN;
  let d = 1;
  for (let i = 0; i < c.length; i++) {
    if (Number.isNaN(a[i])) continue;
    const mid = (c[i].h + c[i].l) / 2;
    const u = mid - mult * a[i];
    const l = mid + mult * a[i];
    const pc = c[i - 1]?.c ?? c[i].c;
    up = Number.isNaN(up) ? u : pc > up ? Math.max(u, up) : u;
    dn = Number.isNaN(dn) ? l : pc < dn ? Math.min(l, dn) : l;
    if (d === -1 && c[i].c > dn) d = 1;
    else if (d === 1 && c[i].c < up) d = -1;
    dir[i] = d;
  }
  return dir;
}
