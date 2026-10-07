import { ema, highest, lowest, macd, rsi, sma, type Candle } from './indicators';

export type EntryKind = 'ema_cross' | 'sma_cross' | 'rsi' | 'macd_cross' | 'breakout';
export type Rules = {
  name: string;
  symbol: string; // e.g. EURUSD
  timeframe: 'H1' | 'H4' | 'D1';
  entry: { kind: EntryKind; fast?: number; slow?: number; period?: number; lower?: number; upper?: number; lookback?: number };
  direction: 'both' | 'long' | 'short';
  stopLossPips: number;
  takeProfitPips: number;
  riskPercent: number;
  maxTradesPerDay: number;
  dailyLossPercent: number;
};

export const DEFAULT_RULES: Rules = {
  name: 'My strategy',
  symbol: 'EURUSD',
  timeframe: 'H1',
  entry: { kind: 'ema_cross', fast: 20, slow: 50 },
  direction: 'both',
  stopLossPips: 20,
  takeProfitPips: 40,
  riskPercent: 1,
  maxTradesPerDay: 3,
  dailyLossPercent: 3,
};

export const ENTRY_LABEL: Record<EntryKind, string> = {
  ema_cross: 'EMA crossover',
  sma_cross: 'SMA crossover',
  rsi: 'RSI levels',
  macd_cross: 'MACD crossover',
  breakout: 'Breakout of recent high/low',
};

const int = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};

/** Makes any incoming rules object safe and complete. */
export function sanitizeRules(r: Partial<Rules> | null | undefined): Rules {
  const x = r || {};
  const e = (x.entry || {}) as Rules['entry'];
  const kinds: EntryKind[] = ['ema_cross', 'sma_cross', 'rsi', 'macd_cross', 'breakout'];
  const kind = kinds.includes(e.kind) ? e.kind : 'ema_cross';
  const entry: Rules['entry'] = { kind };
  if (kind === 'ema_cross' || kind === 'sma_cross') {
    entry.fast = int(e.fast, 20, 2, 400);
    entry.slow = int(e.slow, 50, 3, 500);
    if (entry.fast! >= entry.slow!) [entry.fast, entry.slow] = [Math.min(entry.fast!, entry.slow!), Math.max(entry.fast!, entry.slow!) + (entry.fast === entry.slow ? 1 : 0)];
  } else if (kind === 'rsi') {
    entry.period = int(e.period, 14, 2, 100);
    entry.lower = num(e.lower, 30, 1, 49);
    entry.upper = num(e.upper, 70, 51, 99);
  } else if (kind === 'breakout') {
    entry.lookback = int(e.lookback, 20, 3, 300);
  }
  const tf = ['H1', 'H4', 'D1'].includes(x.timeframe as string) ? (x.timeframe as Rules['timeframe']) : 'H1';
  return {
    name: (typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'My strategy').slice(0, 60),
    symbol: (typeof x.symbol === 'string' ? x.symbol : 'EURUSD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'EURUSD',
    timeframe: tf,
    entry,
    direction: ['both', 'long', 'short'].includes(x.direction as string) ? (x.direction as Rules['direction']) : 'both',
    stopLossPips: num(x.stopLossPips, 20, 1, 5000),
    takeProfitPips: num(x.takeProfitPips, 40, 1, 20000),
    riskPercent: num(x.riskPercent, 1, 0.1, 10),
    maxTradesPerDay: int(x.maxTradesPerDay, 3, 1, 50),
    dailyLossPercent: num(x.dailyLossPercent, 3, 0.5, 50),
  };
}

const SYMBOL_WORDS: [RegExp, string][] = [
  [/\bgold\b|xau\s*\/?\s*usd/i, 'XAUUSD'],
  [/\b(us\s*oil|wti|crude)\b/i, 'WTI'],
  [/\bbitcoin\b|btc\s*\/?\s*usd/i, 'BTCUSD'],
  [/\bethereum\b|eth\s*\/?\s*usd/i, 'ETHUSD'],
  [/\b(s&p|sp500|spx|us500)\b/i, 'SPY'],
  [/\b(nasdaq|nas100|ndx|us100)\b/i, 'QQQ'],
];

/** Reads common strategy descriptions without AI. Returns the rules it understood and questions about anything missing. */
export function parseStrategy(text: string): { rules: Rules; understood: string[]; questions: string[]; confident: boolean } {
  const t = text.replace(/\s+/g, ' ');
  const r: Rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  const understood: string[] = [];
  const questions: string[] = [];
  let entryFound = false;

  const pair = t.match(/\b(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\s*\/?\s*(EUR|GBP|USD|AUD|NZD|CAD|CHF|JPY)\b/i);
  if (pair) {
    r.symbol = (pair[1] + pair[2]).toUpperCase();
    understood.push('market');
  } else {
    for (const [re, s] of SYMBOL_WORDS) if (re.test(t)) { r.symbol = s; understood.push('market'); break; }
  }
  if (!understood.includes('market')) questions.push('Which market should it trade? (for example EUR/USD or gold)');

  if (/\b(4\s*-?\s*h(ou)?r?|h4|four[- ]hour)\b/i.test(t)) r.timeframe = 'H4';
  else if (/\b(daily|d1|1\s*-?\s*day|day chart)\b/i.test(t)) r.timeframe = 'D1';
  else if (/\b(1\s*-?\s*h(ou)?r?|h1|hourly|one[- ]hour)\b/i.test(t)) r.timeframe = 'H1';
  else questions.push('Which chart timeframe? (1-hour, 4-hour or daily)');

  const cross = t.match(/(\d+)\s*(?:-?period\s*)?(ema|sma|ma|moving average)s?\b[^.]*?\bcross(?:es|ing)?\s*(above|over|below|under)\s*(?:the\s*)?(\d+)\s*(ema|sma|ma|moving average)?/i)
    || t.match(/(ema|sma|ma)\s*\(?\s*(\d+)\s*\)?[^.]*?\bcross(?:es|ing)?\s*(above|over|below|under)\s*(?:the\s*)?(ema|sma|ma)?\s*\(?\s*(\d+)/i);
  if (cross) {
    let fast: number, slow: number, type: string, dir: string;
    if (/^\d/.test(cross[1])) { fast = +cross[1]; type = cross[2]; dir = cross[3]; slow = +cross[4]; }
    else { type = cross[1]; fast = +cross[2]; dir = cross[3]; slow = +cross[5]; }
    r.entry = { kind: /sma|^ma$|moving average/i.test(type) && !/ema/i.test(type) ? 'sma_cross' : 'ema_cross', fast: Math.min(fast, slow), slow: Math.max(fast, slow) };
    entryFound = true;
    const buyCross = /above|over/i.test(dir);
    r.direction = /\bsell\b|\bshort\b/i.test(t) && /\bbuy\b|\blong\b/i.test(t) ? 'both' : buyCross ? 'long' : 'short';
    if (r.direction !== 'both' && !/\bsell\b|\bshort\b/i.test(t)) questions.push(`Should it also sell when the ${fast} crosses below the ${slow}?`);
  }
  if (!entryFound) {
    const m = t.match(/rsi\s*\(?\s*(\d+)?\s*\)?[^.]*?\b(below|under|less than|<)\s*(\d+)/i);
    const m2 = t.match(/rsi\s*\(?\s*(\d+)?\s*\)?[^.]*?\b(above|over|greater than|>)\s*(\d+)/i);
    if (m || m2) {
      r.entry = { kind: 'rsi', period: +(m?.[1] || m2?.[1] || 14), lower: m ? +m[3] : 30, upper: m2 ? +m2[3] : 70 };
      entryFound = true;
      r.direction = m && m2 ? 'both' : m ? 'long' : 'short';
      if (!(m && m2)) questions.push(m ? `Should it also sell when RSI goes above ${r.entry.upper}?` : `Should it also buy when RSI goes below ${r.entry.lower}?`);
    }
  }
  if (!entryFound && /macd/i.test(t)) {
    r.entry = { kind: 'macd_cross' };
    entryFound = true;
    r.direction = /\bsell\b|\bshort\b/i.test(t) && !/\bbuy\b|\blong\b/i.test(t) ? 'short' : /\bbuy\b|\blong\b/i.test(t) && !/\bsell\b|\bshort\b/i.test(t) ? 'long' : 'both';
  }
  if (!entryFound) {
    const b = t.match(/break(?:s|out)?[^.]*?(\d+)\s*-?\s*(?:bar|candle|day|period)s?\s*(high|low)/i) || t.match(/(\d+)\s*-?\s*(?:bar|candle|day|period)s?\s*(high|low)[^.]*?break/i);
    if (b) {
      r.entry = { kind: 'breakout', lookback: +b[1] };
      entryFound = true;
      r.direction = /\bsell\b|\bshort\b|\blow\b/i.test(t) && /\bbuy\b|\blong\b|\bhigh\b/i.test(t) ? 'both' : /high/i.test(b[2]) ? 'long' : 'short';
    }
  }
  if (entryFound) understood.push('entry');
  else questions.push('When exactly should it buy or sell? (for example "when the 20 EMA crosses above the 50 EMA" or "when RSI goes below 30")');

  const sl = t.match(/stop[- ]?loss(?: of| at| is|:)?\s*(\d+(?:\.\d+)?)\s*pips?/i) || t.match(/(\d+(?:\.\d+)?)\s*pips?\s*stop/i) || t.match(/\bsl\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (sl) { r.stopLossPips = +sl[1]; understood.push('stop loss'); } else questions.push('How many pips for the stop loss?');
  const tp = t.match(/take[- ]?profit(?: of| at| is|:)?\s*(\d+(?:\.\d+)?)\s*pips?/i) || t.match(/(\d+(?:\.\d+)?)\s*pips?\s*(?:take[- ]?profit|target|profit)/i) || t.match(/\btp\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (tp) { r.takeProfitPips = +tp[1]; understood.push('take profit'); } else questions.push('How many pips for the take profit?');
  const risk = t.match(/risk(?:ing)?\s*(\d+(?:\.\d+)?)\s*%/i) || t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:risk|per trade)/i);
  if (risk) { r.riskPercent = +risk[1]; understood.push('risk'); } else questions.push('How much of your account should it risk per trade? (most traders use 1%)');
  const mx = t.match(/(?:max(?:imum)?|no more than|up to)\s*(\d+)\s*trades?/i);
  if (mx) r.maxTradesPerDay = +mx[1];

  return { rules: sanitizeRules(r), understood, questions, confident: entryFound };
}

export function describeRules(r: Rules) {
  const e = r.entry;
  let buy = '';
  let sell = '';
  if (e.kind === 'ema_cross' || e.kind === 'sma_cross') {
    const n = e.kind === 'ema_cross' ? 'EMA' : 'SMA';
    buy = `${e.fast} ${n} crosses above ${e.slow} ${n}`;
    sell = `${e.fast} ${n} crosses below ${e.slow} ${n}`;
  } else if (e.kind === 'rsi') {
    buy = `RSI(${e.period}) crosses back above ${e.lower}`;
    sell = `RSI(${e.period}) crosses back below ${e.upper}`;
  } else if (e.kind === 'macd_cross') {
    buy = 'MACD (12, 26, 9) crosses above its signal line';
    sell = 'MACD (12, 26, 9) crosses below its signal line';
  } else {
    buy = `Candle closes above the ${e.lookback}-candle high`;
    sell = `Candle closes below the ${e.lookback}-candle low`;
  }
  const tfName = { H1: '1-hour', H4: '4-hour', D1: 'daily' }[r.timeframe];
  return [
    { k: 'Market', v: `${r.symbol}, ${tfName} chart` },
    ...(r.direction !== 'short' ? [{ k: 'Buy when', v: buy }] : []),
    ...(r.direction !== 'long' ? [{ k: 'Sell when', v: sell }] : []),
    { k: 'Stop loss', v: `${r.stopLossPips} pips` },
    { k: 'Take profit', v: `${r.takeProfitPips} pips` },
    { k: 'Risk', v: `${r.riskPercent}% per trade` },
    { k: 'Safety limits', v: `Max ${r.maxTradesPerDay} trades a day · stops for the day after a ${r.dailyLossPercent}% loss · one trade at a time` },
  ];
}

/** Signal on CLOSED candle i: 1 buy, -1 sell, 0 nothing. Precomputes series once. */
export function signalSeries(r: Rules, c: Candle[]): number[] {
  const closes = c.map((x) => x.c);
  const out = new Array(c.length).fill(0);
  const e = r.entry;
  if (e.kind === 'ema_cross' || e.kind === 'sma_cross') {
    const f = e.kind === 'ema_cross' ? ema(closes, e.fast!) : sma(closes, e.fast!);
    const s = e.kind === 'ema_cross' ? ema(closes, e.slow!) : sma(closes, e.slow!);
    for (let i = 1; i < c.length; i++) {
      if (f[i - 1] <= s[i - 1] && f[i] > s[i]) out[i] = 1;
      else if (f[i - 1] >= s[i - 1] && f[i] < s[i]) out[i] = -1;
    }
  } else if (e.kind === 'rsi') {
    const v = rsi(closes, e.period!);
    for (let i = 1; i < c.length; i++) {
      if (v[i - 1] < e.lower! && v[i] >= e.lower!) out[i] = 1;
      else if (v[i - 1] > e.upper! && v[i] <= e.upper!) out[i] = -1;
    }
  } else if (e.kind === 'macd_cross') {
    const m = macd(closes);
    for (let i = 1; i < c.length; i++) {
      if (m.line[i - 1] <= m.signal[i - 1] && m.line[i] > m.signal[i]) out[i] = 1;
      else if (m.line[i - 1] >= m.signal[i - 1] && m.line[i] < m.signal[i]) out[i] = -1;
    }
  } else {
    const n = e.lookback!;
    for (let i = n; i < c.length; i++) {
      if (c[i].c > highest(c, i - n, i - 1)) out[i] = 1;
      else if (c[i].c < lowest(c, i - n, i - 1)) out[i] = -1;
    }
  }
  if (r.direction === 'long') return out.map((v) => (v === 1 ? 1 : 0));
  if (r.direction === 'short') return out.map((v) => (v === -1 ? -1 : 0));
  return out;
}

// ---------- Code generation ----------

const tfMql = { H1: 'PERIOD_H1', H4: 'PERIOD_H4', D1: 'PERIOD_D1' } as const;

export function toMql5(r: Rules) {
  const e = r.entry;
  let handles = '';
  let init = '';
  let signal = '';
  let release = '';
  if (e.kind === 'ema_cross' || e.kind === 'sma_cross') {
    const mode = e.kind === 'ema_cross' ? 'MODE_EMA' : 'MODE_SMA';
    handles = 'int hFast = INVALID_HANDLE, hSlow = INVALID_HANDLE;';
    init = `   hFast = iMA(_Symbol, TF, FastPeriod, 0, ${mode}, PRICE_CLOSE);
   hSlow = iMA(_Symbol, TF, SlowPeriod, 0, ${mode}, PRICE_CLOSE);
   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE) return INIT_FAILED;`;
    release = '   IndicatorRelease(hFast);\n   IndicatorRelease(hSlow);';
    signal = `   double f[], s[];
   ArraySetAsSeries(f, true); ArraySetAsSeries(s, true);
   if(CopyBuffer(hFast, 0, 1, 2, f) < 2 || CopyBuffer(hSlow, 0, 1, 2, s) < 2) return 0;
   if(f[1] <= s[1] && f[0] > s[0]) return 1;
   if(f[1] >= s[1] && f[0] < s[0]) return -1;
   return 0;`;
  } else if (e.kind === 'rsi') {
    handles = 'int hRsi = INVALID_HANDLE;';
    init = `   hRsi = iRSI(_Symbol, TF, RsiPeriod, PRICE_CLOSE);
   if(hRsi == INVALID_HANDLE) return INIT_FAILED;`;
    release = '   IndicatorRelease(hRsi);';
    signal = `   double v[];
   ArraySetAsSeries(v, true);
   if(CopyBuffer(hRsi, 0, 1, 2, v) < 2) return 0;
   if(v[1] < RsiLower && v[0] >= RsiLower) return 1;
   if(v[1] > RsiUpper && v[0] <= RsiUpper) return -1;
   return 0;`;
  } else if (e.kind === 'macd_cross') {
    handles = 'int hMacd = INVALID_HANDLE;';
    init = `   hMacd = iMACD(_Symbol, TF, 12, 26, 9, PRICE_CLOSE);
   if(hMacd == INVALID_HANDLE) return INIT_FAILED;`;
    release = '   IndicatorRelease(hMacd);';
    signal = `   double m[], sg[];
   ArraySetAsSeries(m, true); ArraySetAsSeries(sg, true);
   if(CopyBuffer(hMacd, 0, 1, 2, m) < 2 || CopyBuffer(hMacd, 1, 1, 2, sg) < 2) return 0;
   if(m[1] <= sg[1] && m[0] > sg[0]) return 1;
   if(m[1] >= sg[1] && m[0] < sg[0]) return -1;
   return 0;`;
  } else {
    handles = '';
    init = '';
    signal = `   int hiIdx = iHighest(_Symbol, TF, MODE_HIGH, Lookback, 2);
   int loIdx = iLowest(_Symbol, TF, MODE_LOW, Lookback, 2);
   if(hiIdx < 0 || loIdx < 0) return 0;
   double hi = iHigh(_Symbol, TF, hiIdx), lo = iLow(_Symbol, TF, loIdx);
   double c1 = iClose(_Symbol, TF, 1);
   if(c1 > hi) return 1;
   if(c1 < lo) return -1;
   return 0;`;
  }
  const inputs = [
    e.kind === 'ema_cross' || e.kind === 'sma_cross' ? `input int    FastPeriod = ${e.fast};          // Fast moving average\ninput int    SlowPeriod = ${e.slow};          // Slow moving average` : '',
    e.kind === 'rsi' ? `input int    RsiPeriod = ${e.period};\ninput double RsiLower = ${e.lower};\ninput double RsiUpper = ${e.upper};` : '',
    e.kind === 'breakout' ? `input int    Lookback = ${e.lookback};             // Candles for the high/low` : '',
  ].filter(Boolean).join('\n');
  const allowBuy = r.direction !== 'short';
  const allowSell = r.direction !== 'long';
  return `//+------------------------------------------------------------------+
//| ${r.name.replace(/[^\w\s-]/g, '')} - generated by MarkIQ SI Bot Builder
//| Market: ${r.symbol}  Timeframe: ${r.timeframe}
//| ALWAYS test this on a demo account first. Trading risks real money.
//| This bot never needs your password: it runs inside your own MT5.
//+------------------------------------------------------------------+
#property copyright "Built with MarkIQ SI"
#property version   "1.00"
#include <Trade/Trade.mqh>

input ENUM_TIMEFRAMES TF = ${tfMql[r.timeframe]};
${inputs}
input double RiskPercent = ${r.riskPercent};          // % of equity risked per trade
input double StopLossPips = ${r.stopLossPips};
input double TakeProfitPips = ${r.takeProfitPips};
input int    MaxTradesPerDay = ${r.maxTradesPerDay};
input double DailyLossLimitPercent = ${r.dailyLossPercent}; // stop trading for the day after this loss
input bool   AllowBuy = ${allowBuy};
input bool   AllowSell = ${allowSell};
input double PipSizeOverride = 0;       // leave 0 for automatic
input ulong  MagicNumber = 77010;

CTrade trade;
${handles}
datetime lastBar = 0;
datetime dayStart = 0;
double   dayStartEquity = 0;

double Pip()
{
   if(PipSizeOverride > 0) return PipSizeOverride;
   if(_Digits == 3 || _Digits == 5) return _Point * 10;
   if(_Digits == 2 && StringFind(_Symbol, "XAU") >= 0) return _Point * 10;
   return _Point;
}

int OnInit()
{
   trade.SetExpertMagicNumber(MagicNumber);
${init}
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
${release}
}

int Signal()
{
${signal}
}

bool HasPosition()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong t = PositionGetTicket(i);
      if(t > 0 && PositionGetString(POSITION_SYMBOL) == _Symbol && PositionGetInteger(POSITION_MAGIC) == (long)MagicNumber) return true;
   }
   return false;
}

int TradesToday()
{
   if(!HistorySelect(dayStart, TimeCurrent())) return 0;
   int n = 0;
   for(int i = HistoryDealsTotal() - 1; i >= 0; i--)
   {
      ulong d = HistoryDealGetTicket(i);
      if(d > 0 && HistoryDealGetInteger(d, DEAL_MAGIC) == (long)MagicNumber && HistoryDealGetInteger(d, DEAL_ENTRY) == DEAL_ENTRY_IN) n++;
   }
   return n;
}

double LotsForRisk(double slDistance)
{
   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0 || tickSize <= 0 || slDistance <= 0) return 0;
   double riskMoney = AccountInfoDouble(ACCOUNT_EQUITY) * RiskPercent / 100.0;
   double lossPerLot = slDistance / tickSize * tickValue;
   double lots = riskMoney / lossPerLot;
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   double minL = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxL = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   lots = MathFloor(lots / step) * step;
   if(lots < minL) return 0;            // trade would risk more than allowed, so skip it
   return MathMin(lots, maxL);
}

void OnTick()
{
   MqlDateTime now; TimeToStruct(TimeCurrent(), now);
   now.hour = 0; now.min = 0; now.sec = 0;
   datetime today = StructToTime(now);
   if(today != dayStart) { dayStart = today; dayStartEquity = AccountInfoDouble(ACCOUNT_EQUITY); }

   datetime bar = iTime(_Symbol, TF, 0);
   if(bar == lastBar) return;          // act once per new candle
   lastBar = bar;

   if(AccountInfoDouble(ACCOUNT_EQUITY) <= dayStartEquity * (1.0 - DailyLossLimitPercent / 100.0)) return;
   if(HasPosition()) return;           // one trade at a time
   if(TradesToday() >= MaxTradesPerDay) return;

   int sig = Signal();
   double pip = Pip();
   double sl = StopLossPips * pip, tp = TakeProfitPips * pip;
   double lots = LotsForRisk(sl);
   if(lots <= 0) return;

   if(sig == 1 && AllowBuy)
   {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      trade.Buy(lots, _Symbol, ask, NormalizeDouble(ask - sl, _Digits), NormalizeDouble(ask + tp, _Digits), "MarkIQ SI");
   }
   else if(sig == -1 && AllowSell)
   {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      trade.Sell(lots, _Symbol, bid, NormalizeDouble(bid + sl, _Digits), NormalizeDouble(bid - tp, _Digits), "MarkIQ SI");
   }
}
`;
}

export function toPine(r: Rules) {
  const e = r.entry;
  let calc = '';
  if (e.kind === 'ema_cross' || e.kind === 'sma_cross') {
    const fn = e.kind === 'ema_cross' ? 'ta.ema' : 'ta.sma';
    calc = `fastLen = input.int(${e.fast}, "Fast length")
slowLen = input.int(${e.slow}, "Slow length")
fastMa = ${fn}(close, fastLen)
slowMa = ${fn}(close, slowLen)
plot(fastMa, "Fast", color.new(color.blue, 0))
plot(slowMa, "Slow", color.new(color.orange, 0))
buySignal = ta.crossover(fastMa, slowMa)
sellSignal = ta.crossunder(fastMa, slowMa)`;
  } else if (e.kind === 'rsi') {
    calc = `rsiLen = input.int(${e.period}, "RSI length")
lower = input.float(${e.lower}, "Oversold level")
upper = input.float(${e.upper}, "Overbought level")
r = ta.rsi(close, rsiLen)
buySignal = ta.crossover(r, lower)
sellSignal = ta.crossunder(r, upper)`;
  } else if (e.kind === 'macd_cross') {
    calc = `[macdLine, signalLine, hist] = ta.macd(close, 12, 26, 9)
buySignal = ta.crossover(macdLine, signalLine)
sellSignal = ta.crossunder(macdLine, signalLine)`;
  } else {
    calc = `lookback = input.int(${e.lookback}, "Breakout candles")
buySignal = close > ta.highest(high, lookback)[1]
sellSignal = close < ta.lowest(low, lookback)[1]`;
  }
  return `//@version=6
// ${r.name.replace(/[^\w\s-]/g, '')} - generated by MarkIQ SI Bot Builder
// Use on the ${r.symbol} ${r.timeframe === 'H1' ? '1-hour' : r.timeframe === 'H4' ? '4-hour' : 'daily'} chart. Results on past data never guarantee future results.
strategy("${r.name.replace(/"/g, '')} (MarkIQ SI)", overlay = true, initial_capital = 10000, commission_type = strategy.commission.percent, commission_value = 0.0, slippage = 1, process_orders_on_close = false)

riskPct = input.float(${r.riskPercent}, "Risk % per trade", minval = 0.1, maxval = 10)
slPips = input.float(${r.stopLossPips}, "Stop loss (pips)")
tpPips = input.float(${r.takeProfitPips}, "Take profit (pips)")
allowBuy = input.bool(${r.direction !== 'short'}, "Allow buys")
allowSell = input.bool(${r.direction !== 'long'}, "Allow sells")
maxTradesPerDay = input.int(${r.maxTradesPerDay}, "Max trades per day")
pipSize = syminfo.type == "forex" ? syminfo.mintick * 10 : syminfo.mintick

${calc}

// Position size from risk: lose about riskPct of equity if the stop is hit
slDistance = slPips * pipSize
qty = slDistance > 0 ? (strategy.equity * riskPct / 100) / (slDistance * syminfo.pointvalue) : 0

var int tradesToday = 0
if ta.change(time("D")) != 0
    tradesToday := 0

canTrade = strategy.position_size == 0 and tradesToday < maxTradesPerDay and qty > 0
if buySignal and allowBuy and canTrade
    strategy.entry("Buy", strategy.long, qty = qty)
    tradesToday += 1
if sellSignal and allowSell and canTrade
    strategy.entry("Sell", strategy.short, qty = qty)
    tradesToday += 1

ticks = pipSize / syminfo.mintick
strategy.exit("Buy exit", from_entry = "Buy", loss = slPips * ticks, profit = tpPips * ticks)
strategy.exit("Sell exit", from_entry = "Sell", loss = slPips * ticks, profit = tpPips * ticks)
`;
}
