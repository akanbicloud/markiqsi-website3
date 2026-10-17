import { db } from '../db';
import type { Candle } from '../trading/indicators';
import { SYMBOLS, type TF } from '../trading/symbols';
import { closedOnly } from '../trading/prices';
import { MARKETS, NEEDED, pressure } from './pressure';

export type ChartEvent = {
  i: number; t: number; kind: 'data' | 'news'; theme: string; icon: string; head: string; detail: string;
  dir: 'up' | 'down' | null; move: number | null; count: number; source?: string;
};
export type ChartData = {
  market: string; label: string; tf: TF; digits: number;
  candles: { t: number; o: number; h: number; l: number; c: number; score: number | null; parts: { label: string; value: number }[] }[];
  events: ChartEvent[]; pricingIn: string[]; updated: string;
};

export const THEME_ICON: Record<string, string> = { data: '📊', fed: '🏦', war: '⚔️', trade: '🚢', election: '🗳️', trump: '🇺🇸', energy: '🛢️', other: '📰' };

const DIGITS: Record<string, number> = { XAUUSD: 2, EURUSD: 5, GBPUSD: 5, USDJPY: 3, SPY: 2, BTCUSD: 0 };

/** Candles kept fresh by the background refresh (no extra price-data credits). */
export async function cachedCandles(keys: string[], tf: TF): Promise<Record<string, Candle[]>> {
  const q = await db();
  const rows = (await q`SELECT symbol, candles FROM mq_price_cache WHERE timeframe = ${tf} AND symbol = ANY(${keys})`) as { symbol: string; candles: Candle[] }[];
  return Object.fromEntries(rows.map((r) => [r.symbol, closedOnly((r.candles || []).map((c) => ({ t: Number(c.t), o: +c.o, h: +c.h, l: +c.l, c: +c.c })), tf)]));
}

const HOUR = 3600000;
const pct = (a: number, b: number) => (a ? ((b - a) / a) * 100 : 0);

/** Pins results, past reactions and tagged news to the candle where they landed, with the real move. */
export async function chartEvents(marketKey: string, candles: Candle[], tf: TF): Promise<ChartEvent[]> {
  if (!candles.length) return [];
  const q = await db();
  const ms = ({ '1h': HOUR, '4h': 4 * HOUR, '30min': HOUR / 2, '15min': HOUR / 4, '1day': 24 * HOUR } as Record<string, number>)[tf] || HOUR;
  const from = new Date(candles[0].t).toISOString();
  const to = new Date(candles[candles.length - 1].t + ms).toISOString();
  const [results, reactions, news] = await Promise.all([
    q`SELECT country, name, actual, forecast, verdict, source, released_at FROM mi_results WHERE released_at BETWEEN ${from} AND ${to} ORDER BY released_at`,
    q`SELECT DISTINCT ON (event_name, released_at) event_name, released_at, actual, forecast, surprise FROM mi_reactions WHERE released_at BETWEEN ${from} AND ${to} ORDER BY event_name, released_at`,
    q`SELECT n.id, n.title, n.category, n.tag, n.source, n.published_at, t.theme, t.short, t.impact, t.markets, t.trump
      FROM mi_news n LEFT JOIN mi_news_tags t ON t.news_id = n.id
      WHERE n.published_at BETWEEN ${from} AND ${to} AND (t.impact >= 2 OR (t.news_id IS NULL AND n.category IN ('Central banks', 'Geopolitics')))
      ORDER BY n.published_at`,
  ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];

  const index = (t: number) => {
    let lo = 0, hi = candles.length - 1;
    if (t < candles[0].t || t >= candles[hi].t + ms) return -1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (candles[mid].t <= t) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const moveAt = (i: number) => { const c = candles[i]; return c ? pct(c.o, c.c) : null; };
  const raw: ChartEvent[] = [];
  const seenData = new Set<string>();
  for (const r of results) {
    const t = new Date(String(r.released_at)).getTime(), i = index(t);
    if (i < 0) continue;
    seenData.add(`${i}|${String(r.name).toLowerCase()}`);
    const m = moveAt(i);
    raw.push({ i, t, kind: 'data', theme: 'data', icon: THEME_ICON.data, head: `${r.country} ${r.name}`.slice(0, 40),
      detail: `${r.actual}${r.forecast ? ` vs ${r.forecast} expected` : ''}`, dir: m == null || Math.abs(m) < 0.005 ? null : m > 0 ? 'up' : 'down', move: m, count: 1, source: String(r.source || '') });
  }
  for (const r of reactions) {
    const t = new Date(String(r.released_at)).getTime(), i = index(t);
    const name = String(r.event_name);
    if (i < 0 || [...seenData].some((k) => k.startsWith(`${i}|`) && name.toLowerCase().includes(k.split('|')[1]))) continue;
    const m = moveAt(i);
    raw.push({ i, t, kind: 'data', theme: 'data', icon: THEME_ICON.data, head: name.slice(0, 40),
      detail: `${r.actual ?? ''}${r.forecast ? ` vs ${r.forecast} expected` : r.surprise ? ` · ${String(r.surprise).toLowerCase()}` : ''}`.trim(), dir: m == null || Math.abs(m) < 0.005 ? null : m > 0 ? 'up' : 'down', move: m, count: 1 });
  }
  for (const n of news) {
    const tagged = n.theme != null;
    const mk = Array.isArray(n.markets) ? (n.markets as { market: string }[]).map((x) => String(x.market).toUpperCase().replace(/[^A-Z]/g, '')) : [];
    const relevant = !tagged || mk.length === 0 || mk.some((x) => marketKey.includes(x) || x.includes(marketKey) || (x === 'USD' && marketKey.includes('USD')) || (x === 'GOLD' && marketKey === 'XAUUSD'));
    if (!relevant) continue;
    const t = new Date(String(n.published_at)).getTime(), i = index(t);
    if (i < 0) continue;
    const theme = tagged ? (n.trump ? 'trump' : String(n.theme)) : n.category === 'Central banks' ? 'fed' : 'war';
    const m = moveAt(i);
    raw.push({ i, t, kind: 'news', theme, icon: THEME_ICON[theme] || THEME_ICON.other, head: String(n.short || n.tag || n.title).slice(0, 40),
      detail: String(n.title).slice(0, 140), dir: m == null || Math.abs(m) < 0.005 ? null : m > 0 ? 'up' : 'down', move: m, count: 1, source: String(n.source || '') });
  }
  // one label per candle and theme: "Fed · Comments ×2"
  const merged = new Map<string, ChartEvent>();
  for (const e of raw) {
    const k = `${e.i}|${e.kind === 'data' ? e.head : e.theme}`;
    const have = merged.get(k);
    if (have) have.count++;
    else merged.set(k, { ...e });
  }
  return [...merged.values()].sort((a, b) => a.t - b.t);
}

function pricingIn(events: ChartEvent[], lastT: number): string[] {
  const recent = events.filter((e) => lastT - e.t < 72 * HOUR).reverse();
  const out: string[] = [];
  for (const e of recent) {
    const label = e.kind === 'data' ? `${e.head}` : `${e.theme === 'fed' ? 'Central banks' : e.theme === 'war' ? 'Geopolitics' : e.theme === 'trump' ? 'Trump' : e.theme === 'trade' ? 'Trade' : 'News'}`;
    if (!out.includes(label)) out.push(label);
    if (out.length === 3) break;
  }
  return out;
}

export async function chartData(marketKey: string, tf: TF = '1h', bars = 240): Promise<ChartData | null> {
  const m = MARKETS.find((x) => x.key === marketKey);
  const sym = SYMBOLS.find((s) => s.key === marketKey);
  if (!m || !sym) return null;
  const all = await cachedCandles(Array.from(new Set([...NEEDED, marketKey])), tf);
  const target = all[marketKey] || [];
  if (target.length < 30) return null;
  const pts = pressure(marketKey, target, all);
  const start = Math.max(0, target.length - bars);
  const candles = target.slice(start).map((c, i) => ({ ...c, score: pts[start + i].score, parts: pts[start + i].parts }));
  const events = await chartEvents(marketKey, candles, tf).catch(() => []);
  return { market: marketKey, label: m.label, tf, digits: DIGITS[marketKey] ?? 4, candles, events, pricingIn: pricingIn(events, candles[candles.length - 1].t), updated: new Date().toISOString() };
}
