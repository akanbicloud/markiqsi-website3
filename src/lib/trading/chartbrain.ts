import { ema, atr, swings, type Candle } from './indicators';
import type { StructureSummary } from './structure';
import type { Sym } from './symbols';

/**
 * The "market brain" behind Chart Analysis. Everything here is computed from REAL candles and
 * the economic tables, never from the screenshot, so every number a trader sees is a real price.
 *  - top-down: the higher timeframe's trend and structure
 *  - key zones: places where several reasons line up (swings on two timeframes, previous day /
 *    week highs and lows, the 200 EMA, round numbers), scored by how many agree
 *  - an evidence checklist that says which way each piece of evidence leans
 *  - scenario plans with trigger, invalidation, target and reward-to-risk worked out in code
 */

export type Zone = { id: string; side: 'support' | 'resistance'; price: number; low: number; high: number; score: number; reasons: string[]; distanceAtr: number; atPrice: boolean };
export type Check = { label: string; lean: 'bullish' | 'bearish' | 'neutral' | 'caution'; text: string };
export type Plan = {
  id: 'A' | 'B' | 'C';
  bias: 'Bullish' | 'Bearish';
  kind: 'Breakout' | 'Breakdown' | 'Bounce' | 'Rejection';
  trigger: number;
  invalidation: number;
  target: number | null;
  rr: number | null;
  when: string;
  wrongIf: string;
  aim: string;
  leans: boolean;
};
export type HtfView = { tf: string; label: string; bias: StructureSummary['trend']['bias']; structure: string; ema50: number; ema200: number | null; rsi14: number };
export type RateRow = { bank?: unknown; currency?: unknown; rate?: unknown; next_meeting?: unknown };
export type EventRow = { name?: unknown; currency?: unknown; country?: unknown; impact?: unknown; scheduled_at?: unknown };

export type Brain = {
  htf: HtfView | null;
  zones: Zone[];
  checks: Check[];
  evidence: { bullish: number; bearish: number; lean: 'Bullish' | 'Bearish' | 'Neutral'; summary: string };
  plans: Plan[];
  atr: number;
  atrPips: number;
  rateGap: { base: string; quote: string; baseRate: number; quoteRate: number; gap: number } | null;
  newsSoon: string[];
  chart: Candle[];
};

type Cand = { price: number; weight: number; reason: string; swing?: boolean };

const round = (n: number, d: number) => Number(n.toFixed(d));

function roundStep(sym: Sym) {
  if (sym.group === 'Forex') return sym.pip * 50;
  if (sym.group === 'Gold & Oil') return sym.pip * 100;
  if (sym.group === 'Indices') return sym.pip * 500;
  return sym.pip * 1000;
}

/** Previous day and previous week highs / lows from daily candles (the forming day is ignored). */
function dailyLevels(daily: Candle[] | null, now: number): Cand[] {
  if (!daily || daily.length < 10) return [];
  const startToday = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const done = daily.filter((d) => d.t < startToday);
  const out: Cand[] = [];
  const prev = done[done.length - 1];
  if (prev) out.push({ price: prev.h, weight: 2, reason: 'Previous day high' }, { price: prev.l, weight: 2, reason: 'Previous day low' });
  // previous Monday-to-Friday week
  const d = new Date(startToday);
  const mondayThisWeek = startToday - ((d.getUTCDay() + 6) % 7) * 86400000;
  const lastWeek = done.filter((x) => x.t >= mondayThisWeek - 7 * 86400000 && x.t < mondayThisWeek);
  if (lastWeek.length >= 3) {
    out.push({ price: Math.max(...lastWeek.map((x) => x.h)), weight: 2, reason: 'Previous week high' });
    out.push({ price: Math.min(...lastWeek.map((x) => x.l)), weight: 2, reason: 'Previous week low' });
  }
  return out;
}

export function buildZones(sym: Sym, ltf: Candle[], ltfLabel: string, htf: Candle[] | null, htfLabel: string, daily: Candle[] | null, digits: number, now = Date.now()): { zones: Zone[]; atr: number } {
  const L = ltf.length - 1;
  const last = ltf[L].c;
  const a = atr(ltf, 14)[L] || Math.abs(ltf[L].h - ltf[L].l) || sym.pip * 10;
  const cands: Cand[] = [];
  const ltfSwings = swings(ltf, 3, Math.max(0, L - 250), L);
  const lastHigh = [...ltfSwings].reverse().find((s) => s.type === 'H');
  const lastLow = [...ltfSwings].reverse().find((s) => s.type === 'L');
  for (const s of ltfSwings) {
    const latest = s === lastHigh || s === lastLow;
    cands.push({ price: s.price, weight: latest ? 2 : 1, reason: `${latest ? 'Latest ' : ''}${ltfLabel} swing ${s.type === 'H' ? 'high' : 'low'}`, swing: true });
  }
  if (htf && htf.length > 60) {
    const H = htf.length - 1;
    for (const s of swings(htf, 3, Math.max(0, H - 200), H)) cands.push({ price: s.price, weight: 2, reason: `${htfLabel} swing ${s.type === 'H' ? 'high' : 'low'}` });
    const e50 = ema(htf.map((x) => x.c), 50)[H];
    if (Number.isFinite(e50)) cands.push({ price: e50, weight: 1, reason: `${htfLabel} 50 EMA` });
  }
  if (ltf.length >= 200) {
    const e200 = ema(ltf.map((x) => x.c), 200)[L];
    if (Number.isFinite(e200)) cands.push({ price: e200, weight: 1, reason: `${ltfLabel} 200 EMA` });
  }
  cands.push(...dailyLevels(daily, now));
  const step = roundStep(sym);
  const below = Math.floor(last / step) * step;
  for (const p of [below, below + step, below - step, below + 2 * step]) cands.push({ price: p, weight: 1, reason: `Round number ${round(p, digits)}` });

  // keep levels within a sensible distance of price
  const near = cands.filter((c) => Math.abs(c.price - last) <= a * 12).sort((x, y) => x.price - y.price);
  const tol = Math.max(a * 0.35, sym.pip * 3);
  const groups: Cand[][] = [];
  for (const c of near) {
    const g = groups[groups.length - 1];
    if (g && c.price - g[0].price <= a * 0.8 && Math.abs(c.price - g.reduce((s, x) => s + x.price * x.weight, 0) / g.reduce((s, x) => s + x.weight, 0)) <= tol) g.push(c);
    else groups.push([c]);
  }
  const zones: Zone[] = [];
  for (const g of groups) {
    const w = g.reduce((s, x) => s + x.weight, 0);
    const mid = g.reduce((s, x) => s + x.price * x.weight, 0) / w;
    const touches = g.filter((x) => x.swing).length;
    const reasons = [...new Set(g.map((x) => x.reason))];
    if (touches >= 2) reasons.push(`Touched ${touches} times on ${ltfLabel}`);
    const score = w + Math.max(0, touches - 1);
    const pad = a * 0.12;
    const low = Math.min(...g.map((x) => x.price)) - pad;
    const high = Math.max(...g.map((x) => x.price)) + pad;
    const atPrice = low <= last && last <= high;
    zones.push({ id: '', side: mid >= last ? 'resistance' : 'support', price: round(mid, digits), low: round(low, digits), high: round(high, digits), score, reasons, distanceAtr: Number((Math.abs(mid - last) / a).toFixed(1)), atPrice });
  }
  // Only zones where at least two reasons agree; a lone round number or a single swing is used
  // only when a side has nothing stronger.
  const pick = (side: Zone['side']) => {
    const list = zones.filter((z) => z.side === side).sort((x, y) => x.distanceAtr - y.distanceAtr);
    const strong = list.filter((z) => z.score >= 2);
    let chosen = (strong.length ? strong : list).slice(0, 3);
    // after a fast move the nearest strong zone can be far away; then also show the nearest level
    if (list[0] && !chosen.includes(list[0]) && (chosen[0]?.distanceAtr ?? 99) > 4) chosen = [list[0], ...chosen].slice(0, 3);
    return chosen;
  };
  const res = pick('resistance').map((z, i) => ({ ...z, id: `R${i + 1}` }));
  const sup = pick('support').map((z, i) => ({ ...z, id: `S${i + 1}` }));
  return { zones: [...res.reverse(), ...sup], atr: a };
}

const trendWord = (b: string) => (b === 'up' ? 'up' : b === 'down' ? 'down' : 'sideways');

export function buildChecks(o: {
  ltf: StructureSummary; ltfLabel: string; htf: HtfView | null; zones: Zone[]; atr: number; digits: number;
  rateGap: Brain['rateGap']; newsSoon: string[];
}): Check[] {
  const { ltf, ltfLabel, htf, zones } = o;
  const checks: Check[] = [];
  if (htf) {
    checks.push({ label: `Bigger picture (${htf.label})`, lean: htf.bias === 'up' ? 'bullish' : htf.bias === 'down' ? 'bearish' : 'neutral', text: `${htf.label} trend is ${trendWord(htf.bias)}. ${htf.structure}.` });
  }
  checks.push({ label: `Trend on ${ltfLabel}`, lean: ltf.trend.bias === 'up' ? 'bullish' : ltf.trend.bias === 'down' ? 'bearish' : 'neutral', text: `${ltf.structure}. 20 EMA ${ltf.trend.ema20} vs 50 EMA ${ltf.trend.ema50}.` });
  if (ltf.trend.aboveEma200 != null && ltf.trend.ema200 != null) {
    checks.push({ label: '200 EMA', lean: ltf.trend.aboveEma200 ? 'bullish' : 'bearish', text: `Price is ${ltf.trend.aboveEma200 ? 'above' : 'below'} the ${ltfLabel} 200 EMA (${ltf.trend.ema200}).` });
  }
  const r = ltf.rsi14;
  checks.push(r >= 70 ? { label: 'Momentum (RSI 14)', lean: 'caution', text: `RSI ${r}: stretched to the upside. Pullbacks are common from here.` }
    : r <= 30 ? { label: 'Momentum (RSI 14)', lean: 'caution', text: `RSI ${r}: stretched to the downside. Bounces are common from here.` }
    : r >= 55 ? { label: 'Momentum (RSI 14)', lean: 'bullish', text: `RSI ${r}: buyers have the upper hand.` }
    : r <= 45 ? { label: 'Momentum (RSI 14)', lean: 'bearish', text: `RSI ${r}: sellers have the upper hand.` }
    : { label: 'Momentum (RSI 14)', lean: 'neutral', text: `RSI ${r}: no strong momentum either way.` });
  const s1 = zones.find((z) => z.id === 'S1');
  const r1 = zones.find((z) => z.id === 'R1');
  const atZone = zones.find((z) => z.atPrice || z.distanceAtr <= 0.5);
  if (atZone && atZone.score >= 3) {
    checks.push({ label: 'Location', lean: atZone.side === 'support' ? 'bullish' : 'bearish', text: `Price is at a strong ${atZone.side} zone (${atZone.id} ${atZone.low} to ${atZone.high}): ${atZone.reasons.slice(0, 3).join(', ')}.` });
  } else if (s1 && r1 && s1.distanceAtr >= 1.5 && r1.distanceAtr >= 1.5) {
    checks.push({ label: 'Location', lean: 'caution', text: `Price is in the middle, ${s1.distanceAtr} ATR above support and ${r1.distanceAtr} ATR below resistance. Entries here have poor reward to risk.` });
  } else {
    checks.push({ label: 'Location', lean: 'neutral', text: `Nearest support ${s1 ? `${s1.price} (${s1.distanceAtr} ATR away)` : 'not found'}, nearest resistance ${r1 ? `${r1.price} (${r1.distanceAtr} ATR away)` : 'not found'}.` });
  }
  const setup = ltf.recentSetups.find((x) => x.candlesAgo <= 5 && x.strategy !== 'rsi');
  if (setup) {
    const d = setup.direction.toLowerCase();
    checks.push({ label: 'Recent pattern', lean: d.includes('buy') || d.includes('long') || d.includes('bull') ? 'bullish' : d.includes('sell') || d.includes('short') || d.includes('bear') ? 'bearish' : 'neutral', text: setup.detail });
  }
  if (o.rateGap) {
    const g = o.rateGap;
    checks.push({ label: 'Interest-rate gap', lean: g.gap >= 0.5 ? 'bullish' : g.gap <= -0.5 ? 'bearish' : 'neutral', text: `${g.base} ${g.baseRate}% vs ${g.quote} ${g.quoteRate}%: ${Math.abs(g.gap) < 0.5 ? 'no big difference' : `${g.gap > 0 ? g.base : g.quote} pays more, which supports it over time`}.` });
  }
  if (o.newsSoon.length) checks.push({ label: 'News risk', lean: 'caution', text: `High-impact news within 24 hours: ${o.newsSoon.slice(0, 3).join('; ')}. Levels can break fast around it.` });
  return checks;
}

export function evidenceOf(checks: Check[]): Brain['evidence'] {
  const bullish = checks.filter((c) => c.lean === 'bullish').length;
  const bearish = checks.filter((c) => c.lean === 'bearish').length;
  const lean = bullish - bearish >= 2 ? 'Bullish' : bearish - bullish >= 2 ? 'Bearish' : 'Neutral';
  const summary = lean === 'Neutral'
    ? `Mixed evidence: ${bullish} point${bullish === 1 ? '' : 's'} lean bullish and ${bearish} lean bearish.`
    : `${Math.max(bullish, bearish)} of ${bullish + bearish} directional points lean ${lean.toLowerCase()}.`;
  return { bullish, bearish, lean, summary };
}

export function buildPlans(zones: Zone[], a: number, digits: number, last: number, lean: Brain['evidence']['lean']): Plan[] {
  const z = (id: string) => zones.find((x) => x.id === id);
  const r1 = z('R1'), r2 = z('R2'), s1 = z('S1'), s2 = z('S2');
  const pad = a * 0.5;
  const minRisk = a * 0.8;
  const stopBelow = (t: number, lvl: number) => Math.min(lvl - pad, t - minRisk);
  const stopAbove = (t: number, lvl: number) => Math.max(lvl + pad, t + minRisk);
  const rr = (entry: number, stop: number, target: number | null) => {
    if (target == null) return null;
    const risk = Math.abs(entry - stop);
    const reward = target > entry === stop < entry ? Math.abs(target - entry) : 0;
    return risk > 0 && reward > 0 ? Number((reward / risk).toFixed(1)) : null;
  };
  const plans: Omit<Plan, 'id' | 'leans'>[] = [];
  if (s1 && s1.distanceAtr <= 1.2) {
    const t = s1.high, inv = stopBelow(s1.high, s1.low), tgt = r1?.price ?? null;
    plans.push({ bias: 'Bullish', kind: 'Bounce', trigger: round(t, digits), invalidation: round(inv, digits), target: tgt, rr: rr(t, inv, tgt),
      when: `Price holds support ${s1.id} (${s1.low} to ${s1.high}) and a candle closes back above ${round(t, digits)} with a strong body.`,
      wrongIf: `A candle closes below ${round(inv, digits)}.`, aim: tgt != null ? `Resistance ${r1!.id} at ${tgt}.` : 'The next swing high.' });
  }
  if (r1 && r1.distanceAtr <= 1.2) {
    const t = r1.low, inv = stopAbove(r1.low, r1.high), tgt = s1?.price ?? null;
    plans.push({ bias: 'Bearish', kind: 'Rejection', trigger: round(t, digits), invalidation: round(inv, digits), target: tgt, rr: rr(t, inv, tgt),
      when: `Price fails at resistance ${r1.id} (${r1.low} to ${r1.high}) and a candle closes back below ${round(t, digits)}.`,
      wrongIf: `A candle closes above ${round(inv, digits)}.`, aim: tgt != null ? `Support ${s1!.id} at ${tgt}.` : 'The next swing low.' });
  }
  if (r1) {
    const t = r1.high, inv = stopBelow(r1.high, r1.low), tgt = r2?.price ?? null;
    plans.push({ bias: 'Bullish', kind: 'Breakout', trigger: round(t, digits), invalidation: round(inv, digits), target: tgt, rr: rr(t, inv, tgt),
      when: `A candle closes above resistance ${r1.id} at ${round(t, digits)}, ideally followed by a retest that holds.`,
      wrongIf: `Price falls back below ${round(inv, digits)} (a failed breakout).`, aim: tgt != null ? `Next resistance ${r2!.id} at ${tgt}.` : 'Open space above: trail the stop.' });
  }
  if (s1) {
    const t = s1.low, inv = stopAbove(s1.low, s1.high), tgt = s2?.price ?? null;
    plans.push({ bias: 'Bearish', kind: 'Breakdown', trigger: round(t, digits), invalidation: round(inv, digits), target: tgt, rr: rr(t, inv, tgt),
      when: `A candle closes below support ${s1.id} at ${round(t, digits)}, ideally followed by a retest that fails.`,
      wrongIf: `Price climbs back above ${round(inv, digits)} (a failed breakdown).`, aim: tgt != null ? `Next support ${s2!.id} at ${tgt}.` : 'Open space below: trail the stop.' });
  }
  // the evidence picks which ideas lead; keep three at most
  const order = (p: Omit<Plan, 'id' | 'leans'>) => (lean !== 'Neutral' && p.bias === lean ? 0 : 1) * 10 - (p.rr ?? 0);
  const chosen = plans.sort((x, y) => order(x) - order(y)).slice(0, 3);
  const best = lean === 'Neutral' ? -1 : chosen.findIndex((p) => p.bias === lean);
  void last;
  return chosen.map((p, i) => ({ ...p, id: (['A', 'B', 'C'] as const)[i], leans: i === best }));
}

export function htfView(s: StructureSummary | null, tf: string, label: string): HtfView | null {
  return s ? { tf, label, bias: s.trend.bias, structure: s.structure, ema50: s.trend.ema50, ema200: s.trend.ema200, rsi14: s.rsi14 } : null;
}

export function rateGapOf(sym: Sym, rates: RateRow[]): Brain['rateGap'] {
  if (sym.group !== 'Forex' || sym.currencies.length < 2) return null;
  const [base, quote] = sym.currencies;
  const find = (c: string) => rates.find((r) => String(r.currency) === c);
  const b = find(base), q = find(quote);
  const br = Number(b?.rate), qr = Number(q?.rate);
  if (!b || !q || !Number.isFinite(br) || !Number.isFinite(qr)) return null;
  return { base, quote, baseRate: br, quoteRate: qr, gap: Number((br - qr).toFixed(2)) };
}

export function newsWithin(events: EventRow[], hours: number, now = Date.now()): string[] {
  return events
    .filter((e) => String(e.impact || '').toLowerCase().startsWith('high'))
    .filter((e) => { const t = new Date(String(e.scheduled_at)).getTime(); return t > now && t - now <= hours * 3600000; })
    .map((e) => `${e.name} (${e.currency || e.country}) at ${new Date(String(e.scheduled_at)).toISOString().slice(11, 16)} UTC`);
}
