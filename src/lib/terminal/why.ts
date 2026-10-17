import { gemini } from '../gemini';
import { groundPrices } from '../askbrain';
import type { ChartData } from './data';
import { MARKETS } from './pressure';

export type Why = { time: number; move: number; facts: string[]; events: { icon: string; head: string; detail: string; when: string }[]; ai: string | null };

const pctTxt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/** Plain facts about one candle: its move, which linked markets pushed it, and what happened around it. */
export function candleFacts(d: ChartData, i: number): Omit<Why, 'ai'> {
  const c = d.candles[i];
  const move = c.o ? ((c.c - c.o) / c.o) * 100 : 0;
  const facts: string[] = [];
  facts.push(`${d.label} moved ${pctTxt(move)} in this hour (from ${c.o} to ${c.c}).`);
  // a 3-hour view gives the bigger picture around the candle
  const from = d.candles[Math.max(0, i - 2)];
  if (from && from !== c && from.o) facts.push(`Over the 3 hours to this candle it moved ${pctTxt(((c.c - from.o) / from.o) * 100)}.`);
  if (c.score != null) {
    const m = MARKETS.find((x) => x.key === d.market);
    const strongest = [...c.parts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).filter((p) => Math.abs(p.value) >= 10).slice(0, 2);
    facts.push(`MarkIQ Pressure was ${c.score > 0 ? '+' : ''}${c.score} out of 100 (${c.score >= 0 ? 'linked markets pushing it up' : 'linked markets pushing it down'}).`);
    for (const p of strongest) {
      const drv = m?.drivers.find((x) => x.label === p.label);
      const own = drv ? (drv.weight > 0 ? (p.value > 0 ? 'rose' : 'fell') : (p.value > 0 ? 'fell' : 'rose')) : null;
      facts.push(`${p.label}${own ? ` ${own}` : ''}, which pushed ${d.label} ${p.value > 0 ? 'up' : 'down'} (${p.value > 0 ? '+' : ''}${p.value}).`);
    }
    if (Math.abs(c.score) >= 25 && Math.sign(c.score) !== Math.sign(move) && Math.abs(move) > 0.05) facts.push(`Price went against the pressure this hour, so something specific to ${d.label} (news or positioning) mattered more than the linked markets.`);
  }
  const events = d.events
    .filter((e) => e.i >= i - 2 && e.i <= i)
    .map((e) => ({ icon: e.icon, head: e.head + (e.count > 1 ? ` ×${e.count}` : ''), detail: e.detail, when: e.i === i ? 'this hour' : `${i - e.i} hour${i - e.i > 1 ? 's' : ''} before` }));
  if (!events.length) facts.push('No big economic release or tagged headline landed in this hour or the two before it.');
  return { time: c.t, move, facts, events };
}

const SYSTEM = `You are MarkIQ's market explainer. In 2 or 3 short plain sentences (simple English for beginners in Nigeria), explain why the market moved in this candle.
Use ONLY the facts given. Do not invent numbers, prices, news or quotes. If the facts do not show a clear cause, say the move looks like normal trading or positioning.
Never give a trading instruction or a price target. No markdown.`;

export async function explain(d: ChartData, i: number): Promise<Why> {
  const f = candleFacts(d, i);
  let ai: string | null = null;
  if (process.env.GEMINI_API_KEY) {
    const user = `Market: ${d.label}\nCandle time (UTC): ${new Date(f.time).toISOString()}\nFacts:\n- ${f.facts.join('\n- ')}\nEvents:\n${f.events.map((e) => `- ${e.when}: ${e.head}. ${e.detail}`).join('\n') || '- none'}`;
    try {
      ai = groundPrices((await gemini(SYSTEM, user, { maxTokens: 300, timeoutMs: 20000 })).trim(), { f, c: d.candles[i] }).slice(0, 700) || null;
    } catch {
      ai = null;
    }
  }
  return { ...f, ai };
}
