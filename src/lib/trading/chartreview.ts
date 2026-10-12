import type { StructureSummary } from './structure';

export type ChartAnalysis = {
  seen: string[];
  matches: boolean;
  mismatch: string;
  structure: string[];
  levels: { support: string[]; resistance: string[] };
  fundamentals: string[];
  scenarios: { bias: 'Bullish' | 'Bearish' | 'Neutral'; when: string; invalidation: string; watchFor: string }[];
  leaning: string;
  watch: string[];
  caution: string;
};

const s = (v: unknown, n = 300) => String(v ?? '').slice(0, n);
const list = (v: unknown, k = 6) => (Array.isArray(v) ? v.slice(0, k).map((x) => s(x)) : []);

export function cleanAnalysis(a: ChartAnalysis): ChartAnalysis {
  return {
    seen: list(a.seen),
    matches: a.matches !== false,
    mismatch: s(a.mismatch),
    structure: list(a.structure),
    levels: { support: list(a.levels?.support, 3), resistance: list(a.levels?.resistance, 3) },
    fundamentals: list(a.fundamentals),
    scenarios: a.scenarios.slice(0, 3).map((x) => ({ bias: (['Bullish', 'Bearish', 'Neutral'].includes(x.bias) ? x.bias : 'Neutral') as 'Bullish' | 'Bearish' | 'Neutral', when: s(x.when), invalidation: s(x.invalidation), watchFor: s(x.watchFor) })),
    leaning: s(a.leaning),
    watch: list(a.watch),
    caution: s(a.caution),
  };
}

/** A plain analysis from real price data and the news tables, used when the AI is unavailable. */
export function fromData(st: StructureSummary, events: Record<string, unknown>[], rates: Record<string, unknown>[]): ChartAnalysis {
  const s1 = st.support[0] ?? st.range20.low;
  const s2 = st.support[1] ?? st.range20.low;
  const r1 = st.resistance[0] ?? st.range20.high;
  const r2 = st.resistance[1] ?? st.range20.high;
  const when = (x: unknown) => (x ? new Date(String(x)).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');
  const ev = events.slice(0, 5).map((e) => `${e.name} (${e.country}) on ${when(e.scheduled_at)}${e.impact ? `, ${e.impact} impact` : ''}`);
  const rt = rates.map((r) => `${r.bank} rate ${r.rate}%${r.next_meeting ? `, next meeting ${r.next_meeting}` : ''}`);
  const trendTxt = st.trend.bias === 'up' ? 'Trend is up: the 20 EMA is above the 50 EMA and price is above the 50 EMA.' : st.trend.bias === 'down' ? 'Trend is down: the 20 EMA is below the 50 EMA and price is below the 50 EMA.' : 'No clear trend: the 20 and 50 EMAs are mixed.';
  return {
    seen: [],
    matches: true,
    mismatch: '',
    structure: [
      st.structure + '.',
      trendTxt,
      st.trend.aboveEma200 == null ? '' : `Price is ${st.trend.aboveEma200 ? 'above' : 'below'} the 200 EMA (${st.trend.ema200}).`,
      `RSI(14) is ${st.rsi14}${st.rsi14 >= 70 ? ', which is overbought' : st.rsi14 <= 30 ? ', which is oversold' : ''}.`,
      ...st.recentSetups.slice(0, 3).map((x) => `${x.strategy}: ${x.direction.toLowerCase()} ${x.candlesAgo === 0 ? 'on the last candle' : `${x.candlesAgo} candles ago`}.`),
    ].filter(Boolean),
    levels: { support: st.support.map(String), resistance: st.resistance.map(String) },
    fundamentals: [...ev, ...rt],
    scenarios: [
      { bias: 'Bullish', when: `Price holds above ${s1} and closes above ${r1}.`, invalidation: `A close below ${s1}.`, watchFor: `${r2}` },
      { bias: 'Bearish', when: `Price closes below ${s1}.`, invalidation: `A close back above ${r1}.`, watchFor: `${s2}` },
    ],
    leaning: st.trend.bias === 'up' ? `The price data leans bullish while price stays above ${s1}.` : st.trend.bias === 'down' ? `The price data leans bearish while price stays below ${r1}.` : `No clear lean: price is between ${s1} and ${r1}. Wait for a close outside that range.`,
    watch: [...ev.slice(0, 3), `A close above ${r1} or below ${s1}.`],
    caution: 'Big news can break any level.',
  };
}
