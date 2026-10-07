import { ema, highest, lowest, macd, rsi, sma, type Candle } from './indicators';
import { DETECTORS, bollingerBounce, makeCtx, at, stochCross, supertrendFlip, trendPullback, type Ctx } from './detect';

export type EntryKind =
  | 'ema_cross' | 'sma_cross' | 'rsi' | 'macd_cross' | 'breakout'
  | 'bb' | 'stoch' | 'supertrend' | 'pullback'
  | 'sd' | 'sr' | 'candles' | 'fvg' | 'ob' | 'bos' | 'liq' | 'ote' | 'ibb' | 'london';

export type Params = {
  fast?: number; slow?: number; period?: number; lower?: number; upper?: number; lookback?: number;
  bbPeriod?: number; bbDev?: number; stochK?: number; stochD?: number; stochSmooth?: number;
  stLen?: number; stMult?: number; trendLen?: number; emaLen?: number;
};

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN1';

export type Rules = {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  entry: { kind: EntryKind } & Params;
  confirm: { kind: EntryKind; within: number } | null;
  trendFilter: 'none' | 'ema200';
  session: 'any' | 'london' | 'newyork' | 'london_ny';
  direction: 'both' | 'long' | 'short';
  stopLossPips: number;
  takeProfitPips: number;
  riskPercent: number;
  maxTradesPerDay: number;
  dailyLossPercent: number;
};

export const TIMEFRAME_LABEL: Record<Timeframe, string> = { M1: '1-minute', M5: '5-minute', M15: '15-minute', M30: '30-minute', H1: '1-hour', H4: '4-hour', D1: 'daily', W1: 'weekly', MN1: 'monthly' };

export const ENTRY_GROUPS: { group: string; items: { kind: EntryKind; label: string; desc: string }[] }[] = [
  { group: 'Supply & demand and price action', items: [
    { kind: 'sd', label: 'Supply & demand zones', desc: 'Trade when price returns to a fresh zone where a strong move started.' },
    { kind: 'sr', label: 'Support & resistance', desc: 'Trade the test of a level price has turned at before.' },
    { kind: 'candles', label: 'Candle patterns', desc: 'Engulfing, pin bars, morning and evening stars.' },
    { kind: 'ibb', label: 'Inside bar breakout', desc: 'Trade the break of an inside-bar pattern.' },
  ] },
  { group: 'ICT & SMC', items: [
    { kind: 'fvg', label: 'Fair value gap (FVG)', desc: 'Enter when price trades back into an unfilled gap.' },
    { kind: 'ob', label: 'Order block', desc: 'Enter at the last opposite candle before a break of structure.' },
    { kind: 'bos', label: 'Break of structure / CHoCH', desc: 'Enter when price breaks the last swing high or low.' },
    { kind: 'liq', label: 'Liquidity sweep', desc: 'Enter after price sweeps an old high/low and closes back.' },
    { kind: 'ote', label: 'Optimal trade entry (OTE)', desc: 'Enter on a 62–79% pullback of the last leg.' },
    { kind: 'london', label: 'London breakout', desc: 'Trade the break of the Asian range (07:00–11:00 UTC).' },
  ] },
  { group: 'Indicators', items: [
    { kind: 'ema_cross', label: 'EMA crossover', desc: 'Fast EMA crosses the slow EMA.' },
    { kind: 'sma_cross', label: 'SMA crossover', desc: 'Fast SMA crosses the slow SMA.' },
    { kind: 'pullback', label: 'Trend pullback', desc: 'With the 200 EMA trend, buy/sell the pullback to the 20 EMA.' },
    { kind: 'rsi', label: 'RSI levels', desc: 'RSI comes back from oversold or overbought.' },
    { kind: 'macd_cross', label: 'MACD crossover', desc: 'MACD line crosses its signal line.' },
    { kind: 'bb', label: 'Bollinger Band bounce', desc: 'Price closes back inside the bands.' },
    { kind: 'stoch', label: 'Stochastic cross', desc: 'Stochastic crosses from oversold or overbought.' },
    { kind: 'supertrend', label: 'Supertrend flip', desc: 'Supertrend changes direction.' },
    { kind: 'breakout', label: 'Breakout', desc: 'Close above the recent high or below the recent low.' },
  ] },
];

export const ENTRY_LABEL = Object.fromEntries(ENTRY_GROUPS.flatMap((g) => g.items.map((i) => [i.kind, i.label]))) as Record<EntryKind, string>;
const KINDS = Object.keys(ENTRY_LABEL) as EntryKind[];

/** Ready-made strategies people can start from. */
export const PRESETS: { name: string; desc: string; rules: Partial<Rules> }[] = [
  { name: 'ICT: Sweep + FVG', desc: 'After a liquidity sweep, enter on the fair value gap. London and New York only.', rules: { name: 'ICT Sweep + FVG', timeframe: 'M15', entry: { kind: 'fvg' }, confirm: { kind: 'liq', within: 10 }, session: 'london_ny', stopLossPips: 15, takeProfitPips: 30 } },
  { name: 'SMC: BOS + Order block', desc: 'After a break of structure, enter at the order block.', rules: { name: 'SMC BOS + OB', timeframe: 'H1', entry: { kind: 'ob' }, confirm: { kind: 'bos', within: 15 }, stopLossPips: 20, takeProfitPips: 50 } },
  { name: 'Supply & demand + candle', desc: 'Enter at a fresh zone only when a reversal candle confirms.', rules: { name: 'S&D + candle', timeframe: 'H4', entry: { kind: 'candles' }, confirm: { kind: 'sd', within: 2 }, stopLossPips: 30, takeProfitPips: 90 } },
  { name: 'Trend pullback', desc: 'Trade with the 200 EMA trend, entering on pullbacks to the 20 EMA.', rules: { name: 'Trend pullback', timeframe: 'H1', entry: { kind: 'pullback', trendLen: 200, emaLen: 20 }, stopLossPips: 20, takeProfitPips: 40 } },
  { name: 'London breakout', desc: 'Trade the break of the Asian range in the London morning.', rules: { name: 'London breakout', symbol: 'GBPUSD', timeframe: 'M15', entry: { kind: 'london' }, stopLossPips: 20, takeProfitPips: 40, maxTradesPerDay: 1 } },
  { name: 'OTE with trend filter', desc: 'Fibonacci 62–79% pullbacks, only with the 200 EMA trend.', rules: { name: 'OTE + trend', timeframe: 'H1', entry: { kind: 'ote' }, trendFilter: 'ema200', stopLossPips: 25, takeProfitPips: 60 } },
  { name: 'Bollinger + RSI', desc: 'Band bounce confirmed by RSI coming back from extreme.', rules: { name: 'BB + RSI', timeframe: 'H1', entry: { kind: 'bb', bbPeriod: 20, bbDev: 2 }, confirm: { kind: 'rsi', within: 3 }, stopLossPips: 20, takeProfitPips: 30 } },
  { name: 'Supertrend', desc: 'Follow Supertrend flips, filtered by the 200 EMA.', rules: { name: 'Supertrend', timeframe: 'H4', entry: { kind: 'supertrend', stLen: 10, stMult: 3 }, trendFilter: 'ema200', stopLossPips: 40, takeProfitPips: 80 } },
  { name: 'EMA crossover', desc: 'The classic 20/50 EMA cross.', rules: { name: 'EMA 20/50', timeframe: 'H1', entry: { kind: 'ema_cross', fast: 20, slow: 50 }, stopLossPips: 20, takeProfitPips: 40 } },
];

export const DEFAULT_RULES: Rules = {
  name: 'My strategy',
  symbol: 'EURUSD',
  timeframe: 'H1',
  entry: { kind: 'ema_cross', fast: 20, slow: 50 },
  confirm: null,
  trendFilter: 'none',
  session: 'any',
  direction: 'both',
  stopLossPips: 20,
  takeProfitPips: 40,
  riskPercent: 1,
  maxTradesPerDay: 3,
  dailyLossPercent: 3,
};

const int = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** Every parameter, always filled in, so code generators never see a missing value. */
export function fullParams(p: Params = {}): Required<Params> {
  let fast = int(p.fast, 20, 2, 400);
  let slow = int(p.slow, 50, 3, 500);
  if (fast >= slow) [fast, slow] = [Math.min(fast, slow), Math.max(fast, slow) + (fast === slow ? 1 : 0)];
  return {
    fast, slow,
    period: int(p.period, 14, 2, 100), lower: num(p.lower, 30, 1, 49), upper: num(p.upper, 70, 51, 99),
    lookback: int(p.lookback, 20, 3, 300),
    bbPeriod: int(p.bbPeriod, 20, 5, 200), bbDev: num(p.bbDev, 2, 0.5, 5),
    stochK: int(p.stochK, 14, 3, 100), stochD: int(p.stochD, 3, 1, 20), stochSmooth: int(p.stochSmooth, 3, 1, 20),
    stLen: int(p.stLen, 10, 2, 100), stMult: num(p.stMult, 3, 0.5, 10),
    trendLen: int(p.trendLen, 200, 50, 400), emaLen: int(p.emaLen, 20, 5, 100),
  };
}

export function sanitizeRules(r: Partial<Rules> | null | undefined): Rules {
  const x = r || {};
  const e = (x.entry || {}) as Rules['entry'];
  const kind = KINDS.includes(e.kind) ? e.kind : 'ema_cross';
  const tfs: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
  const cf = x.confirm && KINDS.includes(x.confirm.kind) && x.confirm.kind !== kind ? { kind: x.confirm.kind, within: int(x.confirm.within, 10, 0, 50) } : null;
  return {
    name: (typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'My strategy').slice(0, 60),
    symbol: (typeof x.symbol === 'string' ? x.symbol : 'EURUSD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'EURUSD',
    timeframe: tfs.includes(x.timeframe as Timeframe) ? (x.timeframe as Timeframe) : 'H1',
    entry: { kind, ...fullParams(e) },
    confirm: cf,
    trendFilter: x.trendFilter === 'ema200' ? 'ema200' : 'none',
    session: ['london', 'newyork', 'london_ny'].includes(x.session as string) ? (x.session as Rules['session']) : 'any',
    direction: ['both', 'long', 'short'].includes(x.direction as string) ? (x.direction as Rules['direction']) : 'both',
    stopLossPips: num(x.stopLossPips, 20, 1, 5000),
    takeProfitPips: num(x.takeProfitPips, 40, 1, 20000),
    riskPercent: num(x.riskPercent, 1, 0.1, 10),
    maxTradesPerDay: int(x.maxTradesPerDay, 3, 1, 50),
    dailyLossPercent: num(x.dailyLossPercent, 3, 0.5, 50),
  };
}

// ---------- Plain-words reader ----------

const SYMBOL_WORDS: [RegExp, string][] = [
  [/\bgold\b|xau\s*\/?\s*usd/i, 'XAUUSD'],
  [/\b(us\s*oil|wti|crude)\b/i, 'WTI'],
  [/\bbitcoin\b|btc\s*\/?\s*usd/i, 'BTCUSD'],
  [/\bethereum\b|eth\s*\/?\s*usd/i, 'ETHUSD'],
  [/\b(s&p|sp500|spx|us500)\b/i, 'SPY'],
  [/\b(nasdaq|nas100|ndx|us100)\b/i, 'QQQ'],
];

const PATTERN_WORDS: [RegExp, EntryKind][] = [
  [/fair value gap|\bfvg\b|imbalance/i, 'fvg'],
  [/order ?block|\bob\b/i, 'ob'],
  [/liquidity (sweep|grab)|stop hunt|sweep(s|ing)? (the )?(highs?|lows?|liquidity)/i, 'liq'],
  [/break of structure|\bbos\b|choch|change of character|market structure shift|\bmss\b/i, 'bos'],
  [/\bote\b|optimal trade entry|golden zone|0?\.?62|fib(onacci)? retracement/i, 'ote'],
  [/supply|demand/i, 'sd'],
  [/support|resistance/i, 'sr'],
  [/london (open )?breakout|asian range/i, 'london'],
  [/inside bar breakout|inside[- ]bar break/i, 'ibb'],
  [/engulf|pin ?bar|hammer|shooting star|morning star|evening star|candle(stick)? pattern/i, 'candles'],
  [/bollinger/i, 'bb'],
  [/stoch/i, 'stoch'],
  [/supertrend|super trend/i, 'supertrend'],
  [/pull ?back/i, 'pullback'],
];

export function parseStrategy(text: string): { rules: Rules; understood: string[]; questions: string[]; confident: boolean } {
  const t = text.replace(/\s+/g, ' ');
  const r: Rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  const understood: string[] = [];
  const questions: string[] = [];
  let entryFound = false;
  const wantsBuy = /\bbuy\b|\blong\b|\bbullish\b/i.test(t);
  const wantsSell = /\bsell\b|\bshort\b|\bbearish\b/i.test(t);

  const pair = t.match(/\b(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\s*\/?\s*(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\b/i);
  if (pair) { r.symbol = (pair[1] + pair[2]).toUpperCase(); understood.push('market'); }
  else for (const [re, s] of SYMBOL_WORDS) if (re.test(t)) { r.symbol = s; understood.push('market'); break; }
  if (!understood.includes('market')) questions.push('Which market should it trade? (for example EUR/USD or gold)');

  const tf: [RegExp, Timeframe][] = [
    [/\b(monthly|1\s*-?\s*month|mn1?)\b/i, 'MN1'], [/\b(weekly|1\s*-?\s*week|w1)\b/i, 'W1'], [/\b(daily|d1|1\s*-?\s*day|day chart)\b/i, 'D1'],
    [/\b(4\s*-?\s*h(ou)?r?|h4|four[- ]hour)\b/i, 'H4'], [/\b(1\s*-?\s*h(ou)?r?|h1|hourly|one[- ]hour)\b/i, 'H1'],
    [/\b(30\s*-?\s*min(ute)?s?|m30)\b/i, 'M30'], [/\b(15\s*-?\s*min(ute)?s?|m15)\b/i, 'M15'], [/\b(5\s*-?\s*min(ute)?s?|m5)\b/i, 'M5'], [/\b(1\s*-?\s*min(ute)?|m1)\b/i, 'M1'],
  ];
  const tfHit = tf.find(([re]) => re.test(t));
  if (tfHit) r.timeframe = tfHit[1]; else questions.push('Which chart timeframe? (1-minute up to monthly)');

  const cross = t.match(/(\d+)\s*(?:-?period\s*)?(ema|sma|ma|moving average)s?\b[^.]*?\bcross(?:es|ing)?\s*(above|over|below|under)\s*(?:the\s*)?(\d+)\s*(ema|sma|ma|moving average)?/i)
    || t.match(/(ema|sma|ma)\s*\(?\s*(\d+)\s*\)?[^.]*?\bcross(?:es|ing)?\s*(above|over|below|under)\s*(?:the\s*)?(ema|sma|ma)?\s*\(?\s*(\d+)/i);
  if (cross) {
    let fast: number, slow: number, type: string, dir: string;
    if (/^\d/.test(cross[1])) { fast = +cross[1]; type = cross[2]; dir = cross[3]; slow = +cross[4]; }
    else { type = cross[1]; fast = +cross[2]; dir = cross[3]; slow = +cross[5]; }
    r.entry = { kind: /sma|^ma$|moving average/i.test(type) && !/ema/i.test(type) ? 'sma_cross' : 'ema_cross', fast: Math.min(fast, slow), slow: Math.max(fast, slow) };
    entryFound = true;
    r.direction = wantsBuy && wantsSell ? 'both' : /above|over/i.test(dir) ? 'long' : 'short';
    if (r.direction !== 'both' && !wantsSell) questions.push(`Should it also sell when the ${fast} crosses below the ${slow}?`);
  }
  const patterns = PATTERN_WORDS.filter(([re]) => re.test(t)).map(([, k]) => k);
  if (!entryFound && /\brsi\b/i.test(t) && !patterns.length) {
    const m = t.match(/rsi\s*\(?\s*(\d+)?\s*\)?[^.]*?\b(below|under|less than|<)\s*(\d+)/i);
    const m2 = t.match(/rsi\s*\(?\s*(\d+)?\s*\)?[^.]*?\b(above|over|greater than|>)\s*(\d+)/i);
    r.entry = { kind: 'rsi', period: +(m?.[1] || m2?.[1] || 14), lower: m ? +m[3] : 30, upper: m2 ? +m2[3] : 70 };
    entryFound = true;
    r.direction = (m && m2) || (!m && !m2) ? 'both' : m ? 'long' : 'short';
  }
  if (!entryFound && patterns.length) {
    // the LAST pattern mentioned is usually the entry trigger ("after a sweep, enter on the FVG")
    const order = patterns.map((k) => ({ k, i: t.search(PATTERN_WORDS.find(([, kk]) => kk === k)![0]) })).sort((a, b) => a.i - b.i);
    r.entry = { kind: order[order.length - 1].k };
    if (order.length > 1) r.confirm = { kind: order[order.length - 2].k, within: 10 };
    entryFound = true;
    r.direction = wantsBuy && !wantsSell ? 'long' : wantsSell && !wantsBuy ? 'short' : 'both';
    const bb = t.match(/bollinger[^.]*?\(?\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (bb) Object.assign(r.entry, { bbPeriod: +bb[1], bbDev: +bb[2] });
    const st = t.match(/super ?trend[^.]*?\(?\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (st) Object.assign(r.entry, { stLen: +st[1], stMult: +st[2] });
  }
  if (!entryFound && /macd/i.test(t)) {
    r.entry = { kind: 'macd_cross' };
    entryFound = true;
    r.direction = wantsSell && !wantsBuy ? 'short' : wantsBuy && !wantsSell ? 'long' : 'both';
  }
  if (!entryFound) {
    const b = t.match(/break(?:s|out)?[^.]*?(\d+)\s*-?\s*(?:bar|candle|day|period)s?\s*(high|low)/i) || t.match(/(\d+)\s*-?\s*(?:bar|candle|day|period)s?\s*(high|low)[^.]*?break/i);
    if (b) {
      r.entry = { kind: 'breakout', lookback: +b[1] };
      entryFound = true;
      r.direction = wantsBuy && wantsSell ? 'both' : /high/i.test(b[2]) ? 'long' : 'short';
    }
  }
  if (entryFound) understood.push('entry');
  else questions.push('When exactly should it buy or sell? For example "enter on a fair value gap after a liquidity sweep" or "when the 20 EMA crosses above the 50 EMA".');

  if (/200\s*ema|200\s*-?\s*(period )?moving average|with the trend|trend filter/i.test(t)) r.trendFilter = 'ema200';
  if (/london and new york|london\/new york|london & new york|ny and london|killzones?|kill zones?/i.test(t)) r.session = 'london_ny';
  else if (/london session|during london|london open/i.test(t) && r.entry.kind !== 'london') r.session = 'london';
  else if (/new york session|during new york|ny session|new york open/i.test(t)) r.session = 'newyork';

  const sl = t.match(/stop[- ]?loss(?: of| at| is|:)?\s*(\d+(?:\.\d+)?)\s*pips?/i) || t.match(/(\d+(?:\.\d+)?)\s*pips?\s*stop/i) || t.match(/\bsl\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (sl) { r.stopLossPips = +sl[1]; understood.push('stop loss'); } else questions.push('How many pips for the stop loss?');
  const tp = t.match(/take[- ]?profit(?: of| at| is|:)?\s*(\d+(?:\.\d+)?)\s*pips?/i) || t.match(/(\d+(?:\.\d+)?)\s*pips?\s*(?:take[- ]?profit|target|profit)/i) || t.match(/\btp\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const rr = t.match(/\b1\s*:\s*(\d+(?:\.\d+)?)\b/);
  if (tp) { r.takeProfitPips = +tp[1]; understood.push('take profit'); }
  else if (rr && sl) { r.takeProfitPips = +sl[1] * +rr[1]; understood.push('take profit'); }
  else questions.push('How many pips for the take profit?');
  const risk = t.match(/risk(?:ing)?\s*(\d+(?:\.\d+)?)\s*%/i) || t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:risk|per trade)/i);
  if (risk) { r.riskPercent = +risk[1]; understood.push('risk'); } else questions.push('How much of your account should it risk per trade? (most traders use 1%)');
  const mx = t.match(/(?:max(?:imum)?|no more than|up to)\s*(\d+)\s*trades?/i);
  if (mx) r.maxTradesPerDay = +mx[1];

  return { rules: sanitizeRules(r), understood, questions, confident: entryFound };
}

export function describeRules(r: Rules) {
  const p = fullParams(r.entry);
  const trig = (k: EntryKind, side: 'buy' | 'sell') => {
    const up = side === 'buy';
    switch (k) {
      case 'ema_cross': case 'sma_cross': { const n = k === 'ema_cross' ? 'EMA' : 'SMA'; return `${p.fast} ${n} crosses ${up ? 'above' : 'below'} ${p.slow} ${n}`; }
      case 'rsi': return up ? `RSI(${p.period}) crosses back above ${p.lower}` : `RSI(${p.period}) crosses back below ${p.upper}`;
      case 'macd_cross': return `MACD (12, 26, 9) crosses ${up ? 'above' : 'below'} its signal line`;
      case 'breakout': return up ? `Candle closes above the ${p.lookback}-candle high` : `Candle closes below the ${p.lookback}-candle low`;
      case 'bb': return `Closes back inside the ${up ? 'lower' : 'upper'} Bollinger Band (${p.bbPeriod}, ${p.bbDev})`;
      case 'stoch': return `Stochastic (${p.stochK}, ${p.stochD}, ${p.stochSmooth}) crosses ${up ? 'up from below 20' : 'down from above 80'}`;
      case 'supertrend': return `Supertrend (${p.stLen}, ${p.stMult}) flips ${up ? 'up' : 'down'}`;
      case 'pullback': return `${up ? 'Above' : 'Below'} the ${p.trendLen} EMA, price pulls back to the ${p.emaLen} EMA and closes ${up ? 'higher' : 'lower'}`;
      case 'sd': return `Price returns to a fresh ${up ? 'demand' : 'supply'} zone`;
      case 'sr': return `Price tests ${up ? 'support' : 'resistance'} that held at least twice`;
      case 'candles': return up ? 'Bullish engulfing, hammer or morning star' : 'Bearish engulfing, shooting star or evening star';
      case 'fvg': return `Price trades back into an unfilled ${up ? 'bullish' : 'bearish'} fair value gap`;
      case 'ob': return `Price returns to a ${up ? 'bullish' : 'bearish'} order block`;
      case 'bos': return `Close breaks the last swing ${up ? 'high' : 'low'} (BOS / CHoCH)`;
      case 'liq': return `Price sweeps an old ${up ? 'low' : 'high'} and closes back ${up ? 'above' : 'below'} it`;
      case 'ote': return `Price pulls back 62–79% of the last ${up ? 'up' : 'down'}-leg`;
      case 'ibb': return `Close breaks ${up ? 'above' : 'below'} an inside-bar pattern`;
      case 'london': return `In the London morning, close breaks ${up ? 'above the Asian high' : 'below the Asian low'}`;
    }
  };
  const conf = r.confirm ? ` · only if ${ENTRY_LABEL[r.confirm.kind].toLowerCase()} happened in the same direction within the last ${r.confirm.within} candles` : '';
  const filters = [r.trendFilter === 'ema200' ? 'Only with the 200 EMA trend' : '', r.session !== 'any' ? `Only during ${{ london: 'the London session (07:00–16:00 UTC)', newyork: 'the New York session (12:00–21:00 UTC)', london_ny: 'London and New York (07:00–21:00 UTC)' }[r.session]}` : ''].filter(Boolean).join(' · ');
  return [
    { k: 'Market', v: `${r.symbol}, ${TIMEFRAME_LABEL[r.timeframe]} chart` },
    { k: 'Strategy', v: ENTRY_LABEL[r.entry.kind] + (r.confirm ? ` + ${ENTRY_LABEL[r.confirm.kind]}` : '') },
    ...(r.direction !== 'short' ? [{ k: 'Buy when', v: trig(r.entry.kind, 'buy') + conf }] : []),
    ...(r.direction !== 'long' ? [{ k: 'Sell when', v: trig(r.entry.kind, 'sell') + conf }] : []),
    ...(filters ? [{ k: 'Filters', v: filters }] : []),
    { k: 'Stop loss', v: `${r.stopLossPips} pips` },
    { k: 'Take profit', v: `${r.takeProfitPips} pips` },
    { k: 'Risk', v: `${r.riskPercent}% per trade` },
    { k: 'Safety limits', v: `Max ${r.maxTradesPerDay} trades a day · stops for the day after a ${r.dailyLossPercent}% loss · one trade at a time` },
  ];
}

// ---------- Signals (used by the backtest and by "My strategy" in the scanner) ----------

function kindSeries(kind: EntryKind, p: Required<Params>, c: Candle[], ctx: Ctx | null): number[] {
  const closes = c.map((x) => x.c);
  const out = new Array(c.length).fill(0);
  const crossed = (f: number[], s: number[], i: number) => (f[i - 1] <= s[i - 1] && f[i] > s[i] ? 1 : f[i - 1] >= s[i - 1] && f[i] < s[i] ? -1 : 0);
  if (kind === 'ema_cross' || kind === 'sma_cross') {
    const f = kind === 'ema_cross' ? ema(closes, p.fast) : sma(closes, p.fast);
    const s = kind === 'ema_cross' ? ema(closes, p.slow) : sma(closes, p.slow);
    for (let i = 1; i < c.length; i++) out[i] = crossed(f, s, i);
    return out;
  }
  if (kind === 'rsi') {
    const v = rsi(closes, p.period);
    for (let i = 1; i < c.length; i++) out[i] = v[i - 1] < p.lower && v[i] >= p.lower ? 1 : v[i - 1] > p.upper && v[i] <= p.upper ? -1 : 0;
    return out;
  }
  if (kind === 'macd_cross') {
    const m = macd(closes);
    for (let i = 1; i < c.length; i++) out[i] = crossed(m.line, m.signal, i);
    return out;
  }
  if (kind === 'breakout') {
    for (let i = p.lookback; i < c.length; i++) out[i] = c[i].c > highest(c, i - p.lookback, i - 1) ? 1 : c[i].c < lowest(c, i - p.lookback, i - 1) ? -1 : 0;
    return out;
  }
  if (!ctx) return out;
  for (let i = 80; i < c.length; i++) {
    const x = at(ctx, i);
    let s = null;
    if (kind === 'bb') s = bollingerBounce(x, p.bbPeriod, p.bbDev);
    else if (kind === 'stoch') s = stochCross(x, p.stochK, p.stochD, p.stochSmooth);
    else if (kind === 'supertrend') s = supertrendFlip(x, p.stLen, p.stMult);
    else if (kind === 'pullback') s = trendPullback(x, p.trendLen, p.emaLen);
    else s = DETECTORS[kind]?.(x) || null;
    if (s) out[i] = s.direction === 'Bullish' ? 1 : -1;
  }
  return out;
}

/** Signal on CLOSED candle i: 1 buy, -1 sell, 0 nothing. */
export function signalSeries(r: Rules, c: Candle[]): number[] {
  const p = fullParams(r.entry);
  const ctx = makeCtx(c, 5);
  const main = kindSeries(r.entry.kind, p, c, ctx);
  const conf = r.confirm ? kindSeries(r.confirm.kind, p, c, ctx) : null;
  const e200 = r.trendFilter === 'ema200' ? ema(c.map((x) => x.c), 200) : null;
  const win = { london: [7, 16], newyork: [12, 21], london_ny: [7, 21], any: [0, 24] }[r.session];
  return main.map((s, i) => {
    if (!s) return 0;
    if (r.direction === 'long' && s < 0) return 0;
    if (r.direction === 'short' && s > 0) return 0;
    if (conf) {
      let ok = false;
      for (let k = Math.max(0, i - r.confirm!.within); k <= i; k++) if (conf[k] === s) { ok = true; break; }
      if (!ok) return 0;
    }
    if (e200) {
      if (!(e200[i] > 0)) return 0;
      if (s > 0 && !(c[i].c > e200[i])) return 0;
      if (s < 0 && !(c[i].c < e200[i])) return 0;
    }
    if (r.session !== 'any') {
      const h = new Date(c[i].t).getUTCHours();
      if (h < win[0] || h >= win[1]) return 0;
    }
    return s;
  });
}

export { toMql5 } from './codegen-mql5';
export { toPine } from './codegen-pine';
