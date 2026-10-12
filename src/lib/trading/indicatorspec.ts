import { atr, ema, macd, rsi, sma, stdev, stochastic, type Candle } from './indicators';
import { DEFAULT_RULES, ENTRY_LABEL, describeRules, parseStrategy, sanitizeRules, signalSeries, type Rules } from './botspec';
import { pineCore } from './codegen-pine';
import { MQL5_ENGINE } from './codegen-mql5';

/**
 * A user-built indicator: lines on the price chart, an optional lower panel (RSI, MACD or
 * Stochastic) and optional buy/sell arrows driven by the same signal engine as the Bot Builder.
 * The same spec is drawn on the MarkIQ SI chart and exported to TradingView (Pine v6) and MT5 (MQL5).
 */
export type LineType = 'ema' | 'sma' | 'bb' | 'supertrend' | 'donchian';
export type Line = { type: LineType; length: number; mult: number };
export type PanelType = 'none' | 'rsi' | 'macd' | 'stoch';
export type Panel = { type: PanelType; length: number; lower: number; upper: number };
export type Signals = Pick<Rules, 'entry' | 'confirm' | 'trendFilter' | 'session' | 'direction'>;

export type IndicatorSpec = { name: string; lines: Line[]; panel: Panel; signals: Signals | null; alerts: boolean };

export const LINE_LABEL: Record<LineType, string> = { ema: 'EMA', sma: 'SMA', bb: 'Bollinger Bands', supertrend: 'Supertrend', donchian: 'Donchian channel' };
export const PANEL_LABEL: Record<PanelType, string> = { none: 'No lower panel', rsi: 'RSI', macd: 'MACD', stoch: 'Stochastic' };
export const LINE_COLORS = ['#1A5FD0', '#FF7A45', '#7C3AED', '#0EA5A4', '#B45309', '#DB2777'];

export const DEFAULT_INDICATOR: IndicatorSpec = {
  name: 'My indicator',
  lines: [{ type: 'ema', length: 20, mult: 2 }, { type: 'ema', length: 50, mult: 2 }],
  panel: { type: 'none', length: 14, lower: 30, upper: 70 },
  signals: { entry: { kind: 'ema_cross', fast: 20, slow: 50 }, confirm: null, trendFilter: 'none', session: 'any', direction: 'both' },
  alerts: true,
};

export const INDICATOR_EXAMPLES = [
  'Plot the 20 and 50 EMA and show buy and sell arrows when they cross. Only with the 200 EMA trend.',
  'RSI 14 with 30 and 70 levels, and arrows when RSI comes back from oversold or overbought.',
  'Bollinger Bands 20, 2 with arrows when price closes back inside the bands, plus RSI below.',
  'Mark fair value gaps after a liquidity sweep during London and New York, with alerts.',
  'Supertrend 10, 3 with arrows when it flips, and the 200 EMA.',
];

const int = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

export function sanitizeIndicator(x: Partial<IndicatorSpec> | null | undefined): IndicatorSpec {
  const s = x || {};
  const types: LineType[] = ['ema', 'sma', 'bb', 'supertrend', 'donchian'];
  const lines = (Array.isArray(s.lines) ? s.lines : [])
    .filter((l) => l && types.includes(l.type))
    .slice(0, 6)
    .map((l) => ({ type: l.type, length: int(l.length, l.type === 'supertrend' ? 10 : 20, 2, 400), mult: num(l.mult, l.type === 'supertrend' ? 3 : 2, 0.5, 10) }));
  const pt: PanelType = ['rsi', 'macd', 'stoch'].includes(s.panel?.type as string) ? (s.panel!.type as PanelType) : 'none';
  const panel: Panel = { type: pt, length: int(s.panel?.length, 14, 2, 100), lower: num(s.panel?.lower, pt === 'stoch' ? 20 : 30, 1, 49), upper: num(s.panel?.upper, pt === 'stoch' ? 80 : 70, 51, 99) };
  let signals: Signals | null = null;
  if (s.signals && s.signals.entry) {
    const r = sanitizeRules({ ...DEFAULT_RULES, ...s.signals });
    signals = { entry: r.entry, confirm: r.confirm, trendFilter: r.trendFilter, session: r.session, direction: r.direction };
  }
  return {
    name: (typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'My indicator').slice(0, 60),
    lines,
    panel,
    signals,
    alerts: s.alerts !== false,
  };
}

/** Rules used to compute arrows (symbol/timeframe only matter for labels). */
export function signalRules(spec: IndicatorSpec, symbol = 'EURUSD'): Rules | null {
  if (!spec.signals) return null;
  return sanitizeRules({ ...DEFAULT_RULES, ...spec.signals, name: spec.name, symbol });
}

// ---------- Plain-words reader ----------

export function parseIndicator(text: string): { spec: IndicatorSpec; questions: string[]; confident: boolean } {
  const t = text.replace(/\s+/g, ' ');
  const lines: Line[] = [];
  const add = (type: LineType, length: number, mult = 2) => {
    if (!lines.some((l) => l.type === type && l.length === length)) lines.push({ type, length, mult });
  };
  for (const m of t.matchAll(/(\d{1,3})\s*-?\s*(?:period\s*)?(ema|sma|exponential|simple)\b/gi)) add(/ema|exponential/i.test(m[2]) ? 'ema' : 'sma', +m[1]);
  for (const m of t.matchAll(/\b(ema|sma)\s*\(?\s*(\d{1,3})/gi)) add(m[1].toLowerCase() as LineType, +m[2]);
  for (const m of t.matchAll(/(\d{1,3})\s*(?:and|&|,)\s*(\d{1,3})\s*(ema|sma)s?\b/gi)) { add(m[3].toLowerCase() as LineType, +m[1]); add(m[3].toLowerCase() as LineType, +m[2]); }
  const bb = t.match(/bollinger(?: bands?)?\s*\(?\s*(\d+)?\s*,?\s*(\d+(?:\.\d+)?)?/i);
  if (bb) add('bb', +(bb[1] || 20), +(bb[2] || 2));
  const st = t.match(/super ?trend\s*\(?\s*(\d+)?\s*,?\s*(\d+(?:\.\d+)?)?/i);
  if (st) add('supertrend', +(st[1] || 10), +(st[2] || 3));
  const dc = t.match(/donchian(?: channel)?\s*\(?\s*(\d+)?/i);
  if (dc) add('donchian', +(dc[1] || 20));

  let panel: Panel = { type: 'none', length: 14, lower: 30, upper: 70 };
  const r = t.match(/\brsi\s*\(?\s*(\d+)?/i);
  const lv = t.match(/(\d{1,2})\s*(?:and|&|\/|,)\s*(\d{2})\s*levels?/i);
  if (r) panel = { type: 'rsi', length: +(r[1] || 14), lower: lv ? +lv[1] : 30, upper: lv ? +lv[2] : 70 };
  else if (/macd/i.test(t)) panel = { type: 'macd', length: 14, lower: 30, upper: 70 };
  else if (/stoch/i.test(t)) panel = { type: 'stoch', length: 14, lower: 20, upper: 80 };

  const wantsSignals = /arrow|signal|buy|sell|alert|mark|show (me )?when|cross|flip|sweep|gap|order block|break|engulf|pin ?bar|supply|demand|support|resistance/i.test(t);
  let signals: Signals | null = null;
  let confident = lines.length > 0 || panel.type !== 'none';
  if (wantsSignals) {
    const p = parseStrategy(t) as ReturnType<typeof parseStrategy>;
    const mas = lines.filter((l) => (l.type === 'ema' || l.type === 'sma') && l.length !== 200);
    if (!/(crosses|crossing|cross)\s+(above|over|below|under)/i.test(t) && /cross/i.test(t) && mas.length >= 2) {
      // "20 and 50 EMA ... arrows when they cross"
      const [a, b] = [mas[0], mas[1]].sort((x, y) => x.length - y.length);
      p.rules.entry = { ...p.rules.entry, kind: a.type === 'sma' ? 'sma_cross' : 'ema_cross', fast: a.length, slow: b.length };
      p.rules.direction = /\bonly (buy|long)/i.test(t) ? 'long' : /\bonly (sell|short)/i.test(t) ? 'short' : 'both';
      p.confident = true;
    }
    if (p.confident) {
      signals = { entry: p.rules.entry, confirm: p.rules.confirm, trendFilter: p.rules.trendFilter, session: p.rules.session, direction: p.rules.direction };
      confident = true;
    } else confident = false;
  }
  if (signals?.trendFilter === 'ema200') add('ema', 200);
  if (signals && (signals.entry.kind === 'ema_cross' || signals.entry.kind === 'sma_cross')) {
    const type = signals.entry.kind === 'ema_cross' ? 'ema' : 'sma';
    add(type, signals.entry.fast!);
    add(type, signals.entry.slow!);
  }
  lines.sort((a, b) => (a.type === b.type ? a.length - b.length : 0));
  const questions: string[] = [];
  if (!lines.length && panel.type === 'none' && !signals) questions.push('What should the indicator show? For example "20 and 50 EMA with arrows when they cross" or "RSI 14 with 30 and 70 levels".');
  if (wantsSignals && !signals) questions.push('When exactly should an arrow appear? For example "when the 20 EMA crosses the 50 EMA" or "on a fair value gap after a liquidity sweep".');
  const nameBits = [...lines.map((l) => `${LINE_LABEL[l.type].replace(' Bands', '')}${l.type === 'ema' || l.type === 'sma' ? ' ' + l.length : ''}`), panel.type !== 'none' ? PANEL_LABEL[panel.type] : '', signals ? 'signals' : ''].filter(Boolean);
  return { spec: sanitizeIndicator({ name: nameBits.slice(0, 4).join(' + ') || 'My indicator', lines, panel, signals, alerts: /alert/i.test(t) || !!signals }), questions, confident };
}

export function describeIndicator(spec: IndicatorSpec) {
  const rows: { k: string; v: string }[] = [];
  rows.push({ k: 'On the price chart', v: spec.lines.length ? spec.lines.map(lineName).join(', ') : 'Nothing' });
  if (spec.panel.type !== 'none') rows.push({ k: 'Lower panel', v: panelName(spec.panel) });
  if (spec.signals) {
    const r = signalRules(spec)!;
    for (const row of describeRules(r)) if (['Strategy', 'Buy when', 'Sell when', 'Filters'].includes(row.k)) rows.push({ k: row.k === 'Strategy' ? 'Arrows' : `${row.k.replace(' when', '')} arrow when`, v: row.v });
  } else rows.push({ k: 'Arrows', v: 'None' });
  rows.push({ k: 'Alerts', v: spec.alerts && spec.signals ? 'On buy and sell arrows' : 'Off' });
  return rows;
}

export function lineName(l: Line) {
  if (l.type === 'bb') return `Bollinger Bands (${l.length}, ${l.mult})`;
  if (l.type === 'supertrend') return `Supertrend (${l.length}, ${l.mult})`;
  if (l.type === 'donchian') return `Donchian channel (${l.length})`;
  return `${l.length} ${LINE_LABEL[l.type]}`;
}
export function panelName(p: Panel) {
  if (p.type === 'rsi') return `RSI (${p.length}) with ${p.lower} and ${p.upper} levels`;
  if (p.type === 'macd') return 'MACD (12, 26, 9)';
  if (p.type === 'stoch') return `Stochastic (${p.length}, 3, 3) with ${p.lower} and ${p.upper} levels`;
  return 'None';
}
export { ENTRY_LABEL };

// ---------- Preview (runs in the browser on real history) ----------

export type Preview = {
  lines: { name: string; color: string; values: number[] }[];
  panel: { name: string; series: { name: string; color: string; values: number[]; histogram?: boolean }[]; levels: number[] } | null;
  signals: number[];
};

function supertrendLine(c: Candle[], period: number, mult: number) {
  const a = atr(c, period);
  const out = new Array(c.length).fill(NaN);
  let up = NaN, dn = NaN, d = 1;
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
    out[i] = d === 1 ? up : dn;
  }
  return out;
}

export function computePreview(spec: IndicatorSpec, c: Candle[], symbol = 'EURUSD'): Preview {
  const closes = c.map((x) => x.c);
  const lines: Preview['lines'] = [];
  spec.lines.forEach((l, i) => {
    const color = LINE_COLORS[i % LINE_COLORS.length];
    if (l.type === 'ema') lines.push({ name: lineName(l), color, values: ema(closes, l.length) });
    else if (l.type === 'sma') lines.push({ name: lineName(l), color, values: sma(closes, l.length) });
    else if (l.type === 'bb') {
      const mid = sma(closes, l.length);
      const sd = stdev(closes, l.length);
      lines.push({ name: `BB mid (${l.length})`, color, values: mid });
      lines.push({ name: 'BB upper', color, values: mid.map((m, k) => m + l.mult * sd[k]) });
      lines.push({ name: 'BB lower', color, values: mid.map((m, k) => m - l.mult * sd[k]) });
    } else if (l.type === 'supertrend') lines.push({ name: lineName(l), color, values: supertrendLine(c, l.length, l.mult) });
    else if (l.type === 'donchian') {
      const hi = c.map((_, k) => (k < l.length - 1 ? NaN : Math.max(...c.slice(k - l.length + 1, k + 1).map((x) => x.h))));
      const lo = c.map((_, k) => (k < l.length - 1 ? NaN : Math.min(...c.slice(k - l.length + 1, k + 1).map((x) => x.l))));
      lines.push({ name: `Donchian high (${l.length})`, color, values: hi });
      lines.push({ name: `Donchian low (${l.length})`, color, values: lo });
    }
  });
  let panel: Preview['panel'] = null;
  const p = spec.panel;
  if (p.type === 'rsi') panel = { name: panelName(p), series: [{ name: 'RSI', color: '#7C3AED', values: rsi(closes, p.length) }], levels: [p.lower, p.upper] };
  if (p.type === 'macd') {
    const m = macd(closes);
    panel = { name: panelName(p), series: [{ name: 'Histogram', color: '#94A3B8', values: m.line.map((v, k) => v - m.signal[k]), histogram: true }, { name: 'MACD', color: '#1A5FD0', values: m.line }, { name: 'Signal', color: '#FF7A45', values: m.signal }], levels: [0] };
  }
  if (p.type === 'stoch') {
    const s = stochastic(c, p.length, 3, 3);
    panel = { name: panelName(p), series: [{ name: '%K', color: '#1A5FD0', values: s.k }, { name: '%D', color: '#FF7A45', values: s.d }], levels: [p.lower, p.upper] };
  }
  const r = signalRules(spec, symbol);
  return { lines, panel, signals: r ? signalSeries(r, c) : new Array(c.length).fill(0) };
}

// ---------- TradingView (Pine Script v6) ----------

const q = (s: string) => s.replace(/"/g, '');

export function toPineIndicator(spec: IndicatorSpec) {
  const hasPanel = spec.panel.type !== 'none';
  const fo = hasPanel ? ', force_overlay = true' : '';
  const r = signalRules(spec) || sanitizeRules({ ...DEFAULT_RULES, direction: 'both' });
  const lines: string[] = [];
  spec.lines.forEach((l, i) => {
    const col = `color.new(#${LINE_COLORS[i % LINE_COLORS.length].slice(1)}, 0)`;
    const n = `l${i}`;
    if (l.type === 'ema' || l.type === 'sma') lines.push(`${n}Len = input.int(${l.length}, "${LINE_LABEL[l.type]} ${i + 1} length")\nplot(ta.${l.type}(close, ${n}Len), "${lineName(l)}", ${col}, 2${fo})`);
    if (l.type === 'bb') lines.push(`${n}Len = input.int(${l.length}, "Bollinger length")\n${n}Mult = input.float(${l.mult}, "Bollinger deviation")\n[${n}Mid, ${n}Up, ${n}Lo] = ta.bb(close, ${n}Len, ${n}Mult)\nplot(${n}Mid, "BB mid", ${col}, 1${fo})\nplot(${n}Up, "BB upper", ${col}, 1${fo})\nplot(${n}Lo, "BB lower", ${col}, 1${fo})`);
    if (l.type === 'supertrend') lines.push(`${n}Len = input.int(${l.length}, "Supertrend ATR length")\n${n}Mult = input.float(${l.mult}, "Supertrend factor")\n[${n}Line, ${n}Dir] = ta.supertrend(${n}Mult, ${n}Len)\nplot(${n}Line, "Supertrend", ${n}Dir < 0 ? color.green : color.red, 2, plot.style_linebr${fo})`);
    if (l.type === 'donchian') lines.push(`${n}Len = input.int(${l.length}, "Donchian length")\nplot(ta.highest(high, ${n}Len), "Donchian high", ${col}, 1${fo})\nplot(ta.lowest(low, ${n}Len), "Donchian low", ${col}, 1${fo})`);
  });
  let panel = '';
  const p = spec.panel;
  if (p.type === 'rsi') panel = `pLen = input.int(${p.length}, "RSI length")\npLo = input.float(${p.lower}, "Oversold")\npHi = input.float(${p.upper}, "Overbought")\nplot(ta.rsi(close, pLen), "RSI", color.purple, 2)\nhline(pLo, "Oversold", color.gray)\nhline(pHi, "Overbought", color.gray)`;
  if (p.type === 'macd') panel = `[pM, pS, pH] = ta.macd(close, 12, 26, 9)\nplot(pH, "Histogram", pH >= 0 ? color.new(color.teal, 40) : color.new(color.red, 40), style = plot.style_columns)\nplot(pM, "MACD", color.blue, 2)\nplot(pS, "Signal", color.orange, 2)\nhline(0, "Zero", color.gray)`;
  if (p.type === 'stoch') panel = `pLen = input.int(${p.length}, "Stochastic %K")\npK = ta.sma(ta.stoch(close, high, low, pLen), 3)\npD = ta.sma(pK, 3)\nplot(pK, "%K", color.blue, 2)\nplot(pD, "%D", color.orange, 2)\nhline(${p.lower}, "Oversold", color.gray)\nhline(${p.upper}, "Overbought", color.gray)`;

  const sig = spec.signals
    ? `
// ---- Buy and sell arrows (same rules as the MarkIQ SI Bot Builder) ----
${pineCore(r)}
plotshape(finalSig == 1, "Buy arrow", shape.triangleup, location.belowbar, color.new(color.green, 0), size = size.small${fo})
plotshape(finalSig == -1, "Sell arrow", shape.triangledown, location.abovebar, color.new(color.red, 0), size = size.small${fo})
${spec.alerts ? `alertcondition(finalSig == 1, "MarkIQ SI buy", "{{ticker}} buy setup on {{interval}}")\nalertcondition(finalSig == -1, "MarkIQ SI sell", "{{ticker}} sell setup on {{interval}}")` : ''}`
    : '';
  return `//@version=6
// ${q(spec.name).replace(/[^\w\s+-]/g, '')} - built with the MarkIQ SI Indicator Builder (www.markiqsi.com)
// An indicator shows information. It does not place trades and does not guarantee results.
indicator("${q(spec.name)} (MarkIQ SI)", overlay = ${hasPanel ? 'false' : 'true'}, max_bars_back = 500)
${lines.join('\n')}
${panel}
${sig}
`.replace(/\n{3,}/g, '\n\n');
}

// ---------- MetaTrader 5 (MQL5) ----------

/**
 * MT5 cannot draw on the price chart and in a separate window from one indicator, so the MT5
 * file draws the price-chart parts (lines and arrows). For the lower panel, MT5's built-in
 * RSI, MACD or Stochastic is used with the same settings (explained in the file).
 */
export function toMql5Indicator(spec: IndicatorSpec) {
  const r = signalRules(spec) || sanitizeRules({ ...DEFAULT_RULES });
  const e = r.entry as Required<Rules['entry']>;
  const sess = { any: [0, 24], london: [7, 16], newyork: [12, 21], london_ny: [7, 21] }[r.session];
  const KIND: Record<string, number> = { ema_cross: 1, sma_cross: 2, rsi: 3, macd_cross: 4, breakout: 5, bb: 6, stoch: 7, supertrend: 8, pullback: 9, sd: 10, sr: 11, candles: 12, fvg: 13, ob: 14, bos: 15, liq: 16, ote: 17, ibb: 18, london: 19 };

  const panelNote =
    spec.panel.type === 'rsi' ? `// Lower panel: add MT5's built-in RSI (Insert > Indicators > Oscillators > Relative Strength Index), period ${spec.panel.length}, levels ${spec.panel.lower} and ${spec.panel.upper}.`
      : spec.panel.type === 'macd' ? '// Lower panel: add MT5\'s built-in MACD (Insert > Indicators > Oscillators > MACD), 12, 26, 9.'
        : spec.panel.type === 'stoch' ? `// Lower panel: add MT5's built-in Stochastic Oscillator (Insert > Indicators > Oscillators), ${spec.panel.length}, 3, 3, levels ${spec.panel.lower} and ${spec.panel.upper}.`
          : '';

  type Buf = { label: string; color: string; kind: 'line' | 'arrow'; arrow?: number; calc: string };
  const bufs: Buf[] = [];
  const mqlColor = (hex: string) => `C'${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}'`;
  spec.lines.forEach((l, i) => {
    const color = mqlColor(LINE_COLORS[i % LINE_COLORS.length]);
    if (l.type === 'ema') bufs.push({ label: lineName(l), color, kind: 'line', calc: `EmaArr(CL, ${l.length}, T); COPY` });
    if (l.type === 'sma') bufs.push({ label: lineName(l), color, kind: 'line', calc: `SmaArr(CL, ${l.length}, T); COPY` });
    if (l.type === 'bb') {
      bufs.push({ label: 'BB mid', color, kind: 'line', calc: `SmaArr(CL, ${l.length}, T); COPY` });
      bufs.push({ label: 'BB upper', color, kind: 'line', calc: `{ double m[], s[]; SmaArr(CL, ${l.length}, m); StdArr(CL, ${l.length}, m, s); ArrayResize(T, N); for(int k = 0; k < N; k++) T[k] = (Ok(m[k]) && Ok(s[k])) ? m[k] + ${l.mult} * s[k] : EMPTY_VALUE; } COPY` });
      bufs.push({ label: 'BB lower', color, kind: 'line', calc: `{ double m[], s[]; SmaArr(CL, ${l.length}, m); StdArr(CL, ${l.length}, m, s); ArrayResize(T, N); for(int k = 0; k < N; k++) T[k] = (Ok(m[k]) && Ok(s[k])) ? m[k] - ${l.mult} * s[k] : EMPTY_VALUE; } COPY` });
    }
    if (l.type === 'supertrend') bufs.push({ label: lineName(l), color, kind: 'line', calc: `SupertrendLine(${l.length}, ${l.mult}, T); COPY` });
    if (l.type === 'donchian') {
      bufs.push({ label: 'Donchian high', color, kind: 'line', calc: `ArrayResize(T, N); for(int k = 0; k < N; k++) T[k] = k >= ${l.length - 1} ? Highest(k - ${l.length - 1}, k) : EMPTY_VALUE; COPY` });
      bufs.push({ label: 'Donchian low', color, kind: 'line', calc: `ArrayResize(T, N); for(int k = 0; k < N; k++) T[k] = k >= ${l.length - 1} ? Lowest(k - ${l.length - 1}, k) : EMPTY_VALUE; COPY` });
    }
  });
  if (spec.signals) {
    bufs.push({ label: 'Buy arrow', color: 'clrLimeGreen', kind: 'arrow', arrow: 233, calc: '' });
    bufs.push({ label: 'Sell arrow', color: 'clrTomato', kind: 'arrow', arrow: 234, calc: '' });
  }
  if (!bufs.length) {
    return `// ${spec.name.replace(/[^\w\s+-]/g, '')} - MarkIQ SI Indicator Builder
// This indicator only has a lower panel, and MT5 already includes it.
${panelNote || '// Add a line or arrows in the Indicator Builder to get an MT5 file.'}
`;
  }
  const n = bufs.length;
  const props = bufs
    .map((b, i) => `#property indicator_label${i + 1}  "${b.label}"\n#property indicator_type${i + 1}   ${b.kind === 'arrow' ? 'DRAW_ARROW' : 'DRAW_LINE'}\n#property indicator_color${i + 1}  ${b.color}\n#property indicator_width${i + 1}  ${b.kind === 'arrow' ? 2 : 2}`)
    .join('\n');
  const decl = bufs.map((_, i) => `double B${i}[];`).join('\n');
  const init = bufs
    .map((b, i) => `   SetIndexBuffer(${i}, B${i}, INDICATOR_DATA); ArraySetAsSeries(B${i}, true); PlotIndexSetDouble(${i}, PLOT_EMPTY_VALUE, EMPTY_VALUE);${b.kind === 'arrow' ? ` PlotIndexSetInteger(${i}, PLOT_ARROW, ${b.arrow});` : ''}`)
    .join('\n');
  const lineCalcs = bufs
    .map((b, i) => (b.kind === 'line' ? `   ${b.calc.replace('COPY', `ToChart(T, B${i}, rates_total);`)}` : ''))
    .filter(Boolean)
    .join('\n');
  const buyIdx = bufs.findIndex((b) => b.label === 'Buy arrow');
  const arrowCalc = spec.signals
    ? `   double gap = 0; for(int k = MathMax(0, N - 100); k < N; k++) gap += (R[k].high - R[k].low); gap = gap / MathMax(1, MathMin(100, N)) * 0.5;
   for(int L = 80; L < N; L++)
   {
      int s = SignalAt(L);
      if(s == 0) continue;
      int sh = iBarShift(_Symbol, _Period, R[L].time, true);
      if(sh < 0 || sh >= rates_total) continue;
      if(s == 1) B${buyIdx}[sh] = R[L].low - gap; else B${buyIdx + 1}[sh] = R[L].high + gap;
      if(UseAlerts && L == N - 1 && R[L].time != lastAlert) { lastAlert = R[L].time; Alert(_Symbol, " ", EnumToString(_Period), s == 1 ? ": MarkIQ SI buy setup" : ": MarkIQ SI sell setup"); }
   }`
    : '';


  return `//+------------------------------------------------------------------+
//| ${spec.name.replace(/[^\w\s+-]/g, '')} - built with the MarkIQ SI Indicator Builder
//| www.markiqsi.com  ·  An indicator shows information. It does not trade.
${panelNote}
//+------------------------------------------------------------------+
#property copyright "Built with MarkIQ SI"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers ${n}
#property indicator_plots   ${n}
${props}

input bool   UseAlerts = ${spec.alerts && !!spec.signals};
input int    BarsToLoad = 1500;
input int    BrokerGMTOffsetHours = 2;  // your broker's server time minus UTC (often 2 or 3)
input int    EntryKind = ${KIND[r.entry.kind]};
input int    ConfirmKind = ${r.confirm ? KIND[r.confirm.kind] : 0};
input int    ConfirmWithin = ${r.confirm ? r.confirm.within : 0};
input bool   UseTrendFilter = ${r.trendFilter === 'ema200'};
input int    SessionStartUTC = ${sess[0]};
input int    SessionEndUTC = ${sess[1]};
input bool   AllowBuy = ${r.direction !== 'short'};
input bool   AllowSell = ${r.direction !== 'long'};
input int    MaKind = ${r.entry.kind === 'sma_cross' ? 2 : 1};
input int    FastPeriod = ${e.fast};
input int    SlowPeriod = ${e.slow};
input int    RsiPeriod = ${e.period};
input double RsiLower = ${e.lower};
input double RsiUpper = ${e.upper};
input int    Lookback = ${e.lookback};
input int    BBPeriod = ${e.bbPeriod};
input double BBDev = ${e.bbDev};
input int    StochK = ${e.stochK};
input int    StochD = ${e.stochD};
input int    StochSmooth = ${e.stochSmooth};
input int    STPeriod = ${e.stLen};
input double STMult = ${e.stMult};
input int    TrendLen = ${e.trendLen};
input int    PullbackEma = ${e.emaLen};

ENUM_TIMEFRAMES TF = PERIOD_CURRENT;
${decl}
double T[];
datetime lastBar = 0, lastAlert = 0;
${MQL5_ENGINE}
int SignalAt(int L)
{
   int s = Detect(EntryKind, L);
   if(s == 0) return 0;
   if(s == 1 && !AllowBuy) return 0;
   if(s == -1 && !AllowSell) return 0;
   if(ConfirmKind > 0)
   {
      bool ok = false;
      for(int k = MathMax(80, L - ConfirmWithin); k <= L; k++) if(Detect(ConfirmKind, k) == s) { ok = true; break; }
      if(!ok) return 0;
   }
   if(UseTrendFilter) { if(!Ok(E200[L])) return 0; if(s == 1 && !(Cl(L) > E200[L])) return 0; if(s == -1 && !(Cl(L) < E200[L])) return 0; }
   if(SessionStartUTC != 0 || SessionEndUTC != 24) { int h = UtcHour(L); if(h < SessionStartUTC || h >= SessionEndUTC) return 0; }
   return s;
}

void SupertrendLine(int period, double mult, double &out[])
{
   ArrayResize(out, N); ArrayInitialize(out, EMPTY_VALUE);
   double a[]; AtrArr(period, a);
   double up = 0, dn = 0; int d = 1; bool started = false;
   for(int i = 0; i < N; i++)
   {
      if(!Ok(a[i]) || a[i] <= 0) continue;
      double mid = (R[i].high + R[i].low) / 2, u = mid - mult * a[i], l = mid + mult * a[i];
      double pc = i > 0 ? R[i - 1].close : R[i].close;
      if(!started) { up = u; dn = l; started = true; }
      else { up = pc > up ? MathMax(u, up) : u; dn = pc < dn ? MathMin(l, dn) : l; }
      if(d == -1 && R[i].close > dn) d = 1; else if(d == 1 && R[i].close < up) d = -1;
      out[i] = d == 1 ? up : dn;
   }
}

// Copy an oldest-first array (R[0] oldest) onto a chart buffer (series order).
void ToChart(const double &src[], double &buf[], int rates_total)
{
   for(int L = 0; L < N; L++)
   {
      int sh = iBarShift(_Symbol, _Period, R[L].time, true);
      if(sh >= 0 && sh < rates_total) buf[sh] = src[L];
   }
}

int OnInit()
{
${init}
   IndicatorSetString(INDICATOR_SHORTNAME, "${q(spec.name)} (MarkIQ SI)");
   return INIT_SUCCEEDED;
}

int OnCalculate(const int rates_total, const int prev_calculated, const datetime &time[], const double &open[], const double &high[], const double &low[], const double &close[], const long &tick_volume[], const long &volume[], const int &spread[])
{
   datetime bar = iTime(_Symbol, _Period, 0);
   if(prev_calculated > 0 && bar == lastBar) return rates_total;   // recalculate once per new candle
   lastBar = bar;
${bufs.map((_, i) => `   ArrayInitialize(B${i}, EMPTY_VALUE);`).join('\n')}
   if(!LoadBars()) return 0;
${lineCalcs}
${arrowCalc}
   return rates_total;
}
`;
}
