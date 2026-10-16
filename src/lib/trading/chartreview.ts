import type { Brain } from './chartbrain';
import type { StructureSummary } from './structure';

/** What the AI writes. Every price the trader sees comes from the Brain (code), not from here. */
export type ChartAnalysis = {
  story: string;            // the big picture, top-down, in 3-4 sentences
  seen: string[];           // what is on the screenshot
  drawings: string[];       // feedback on the trader's own drawings vs the real zones
  matches: boolean;
  mismatch: string;
  structure: string[];
  fundamentals: string[];
  fundamentalStory: string; // how the news / rates connect to this market
  planNotes: Record<string, string>; // extra explanation per plan id (A, B, C)
  leaning: string;
  answer: string;           // direct answer to the trader's question
  mistakes: string[];       // common mistakes to avoid on this chart
  watch: string[];
  caution: string;
};

const s = (v: unknown, n = 400) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (v: unknown, k = 6, n = 300) => (Array.isArray(v) ? v.slice(0, k).map((x) => s(x, n)).filter(Boolean) : []);

const NUM = /\d[\d,]*(?:\.\d+)?/g;
const BANNED = /\b(buy now|sell now|go long now|go short now|guarantee\w*|certain(ly)?|risk[- ]free|lot size|position size|all in)\b/i;

/** Every number in DATA (prices, RSI, rates...) plus small counts, as floats. */
export function allowedNumbers(data: unknown): number[] {
  const out = new Set<number>();
  for (const m of JSON.stringify(data).match(NUM) || []) {
    const v = Number(m.replace(/,/g, ''));
    if (Number.isFinite(v)) out.add(v);
  }
  for (let i = 0; i <= 30; i++) out.add(i);
  return [...out];
}

function numbersOk(text: string, allowed: number[]) {
  for (const m of text.match(NUM) || []) {
    const v = Number(m.replace(/,/g, ''));
    if (!Number.isFinite(v)) continue;
    const ok = allowed.some((a) => a === v || (a !== 0 && Math.abs(a - v) / Math.abs(a) < 1e-9) || Math.abs(a - v) < 1e-9);
    if (!ok) return false;
  }
  return true;
}

/** Keeps only sentences whose numbers all exist in DATA and that are not trade calls. */
export function groundText(text: string, allowed: number[]): string {
  const parts = s(text, 1200).split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p && !BANNED.test(p) && numbersOk(p, allowed)).join(' ').trim();
}

const groundList = (v: string[], allowed: number[]) => v.map((x) => groundText(x, allowed)).filter(Boolean);

export function cleanAnalysis(a: Partial<ChartAnalysis> & { plans?: { id?: string; explain?: string }[] }, allowed: number[]): ChartAnalysis {
  const planNotes: Record<string, string> = {};
  for (const p of Array.isArray(a.plans) ? a.plans.slice(0, 3) : []) {
    const id = s(p?.id, 2).toUpperCase();
    const note = groundText(s(p?.explain, 400), allowed);
    if (['A', 'B', 'C'].includes(id) && note) planNotes[id] = note;
  }
  return {
    story: groundText(s(a.story, 900), allowed),
    seen: groundList(list(a.seen), allowed),
    drawings: groundList(list(a.drawings, 4), allowed),
    matches: a.matches !== false,
    mismatch: s(a.mismatch),
    structure: groundList(list(a.structure), allowed),
    fundamentals: groundList(list(a.fundamentals), allowed),
    fundamentalStory: groundText(s(a.fundamentalStory, 600), allowed),
    planNotes,
    leaning: groundText(s(a.leaning), allowed),
    answer: groundText(s(a.answer, 600), allowed),
    mistakes: groundList(list(a.mistakes, 4), allowed),
    watch: groundList(list(a.watch), allowed),
    caution: groundText(s(a.caution), allowed),
  };
}

const when = (x: unknown) => (x ? new Date(String(x)).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '');

/** A full analysis from real price data and the news tables, used when the AI is unavailable. */
export function fromData(st: StructureSummary, brain: Brain, events: Record<string, unknown>[], rates: Record<string, unknown>[], tfLabel: string): ChartAnalysis {
  const r1 = brain.zones.find((z) => z.id === 'R1');
  const s1 = brain.zones.find((z) => z.id === 'S1');
  const big = brain.htf ? `On the ${brain.htf.label} chart the trend is ${brain.htf.bias === 'sideways' ? 'sideways' : brain.htf.bias}. ` : '';
  const story = `${big}On the ${tfLabel} chart: ${st.structure.toLowerCase()}. ${s1 && r1 ? `Price sits between support ${s1.price} and resistance ${r1.price}.` : ''}`.trim();
  const lead = brain.plans.find((p) => p.leans);
  return {
    story,
    seen: [],
    drawings: [],
    matches: true,
    mismatch: '',
    structure: [
      st.structure + '.',
      st.trend.bias === 'up' ? 'The 20 EMA is above the 50 EMA and price is above the 50 EMA.' : st.trend.bias === 'down' ? 'The 20 EMA is below the 50 EMA and price is below the 50 EMA.' : 'The 20 and 50 EMAs are mixed: no clear trend.',
      ...st.recentSetups.slice(0, 2).map((x) => x.detail),
    ],
    fundamentals: [
      ...events.slice(0, 5).map((e) => `${e.name} (${e.country}) on ${when(e.scheduled_at)}${e.impact ? `, ${e.impact} impact` : ''}`),
      ...rates.map((r) => `${r.bank} rate ${r.rate}%${r.next_meeting ? `, next meeting ${r.next_meeting}` : ''}`),
    ],
    fundamentalStory: '',
    planNotes: {},
    leaning: lead ? `The evidence leans ${lead.bias.toLowerCase()}: plan ${lead.id} (${lead.kind.toLowerCase()}) fits it best.` : 'The evidence is mixed. Waiting for price to reach a zone is often the better trade.',
    answer: '',
    mistakes: [],
    watch: [
      ...brain.newsSoon.slice(0, 2),
      r1 && s1 ? `A candle close above ${r1.high} or below ${s1.low}.` : '',
    ].filter(Boolean),
    caution: 'Big news can break any level.',
  };
}
