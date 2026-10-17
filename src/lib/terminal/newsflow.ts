import { db } from '../db';
import { gemini, parseJson } from '../gemini';

/**
 * News Flow: each headline is tagged once by AI (theme, tone, who said it, which markets it touches
 * and the chain from headline to market). Tags describe the story; they never invent prices.
 */

export const THEMES = ['fed', 'war', 'trade', 'election', 'trump', 'energy', 'data', 'other'] as const;
export type Theme = (typeof THEMES)[number];
export type Tag = { id: string; story: string; theme: Theme; tone: number; speaker: string | null; trump: boolean; impact: number; markets: { market: string; dir: 'up' | 'down' }[]; chain: string; short: string };

const SYSTEM = `You tag market news for MarkIQ SI, a trading academy. For EACH item return an object:
{"id": same id, "story": 2-4 word name of the ongoing story (e.g. "US-China tariffs", "Fed rate path", "Middle East conflict"),
 "theme": one of fed|war|trade|election|trump|energy|data|other (central banks of any country = fed; wars, attacks, sanctions, coups = war; anything said or done by Donald Trump = trump),
 "tone": integer -2..2. For fed: -2 very dovish (cuts, easing) .. +2 very hawkish (hikes, sticky inflation). For war: -2 strong calming (ceasefire, talks) .. +2 strong escalation. Otherwise: -2 very risk-off .. +2 very risk-on,
 "speaker": person or institution quoted, or null, "trump": true if Donald Trump said or did it,
 "impact": 1 low, 2 medium, 3 high for currencies/gold/stocks,
 "markets": up to 3 of USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, GOLD, OIL, STOCKS, BTC with the direction this news would usually push them: [{"market":"GOLD","dir":"up"}],
 "chain": one short line using arrows, like "Tariff threat → risk-off → JPY and gold up",
 "short": a label of at most 32 characters for a chart, like "Trump tariff post" or "ECB holds rates"}
Only use what the headline and summary say. Do not invent numbers or quotes. Return JSON: {"items":[...]}`;

const clampInt = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const MK = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'GOLD', 'OIL', 'STOCKS', 'BTC'];

/** Pure: checks and cleans what the AI returned (tested). */
export function cleanTags(raw: unknown, ids: string[]): Tag[] {
  const items = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return [];
  const out: Tag[] = [];
  for (const it of items as Record<string, unknown>[]) {
    const id = String(it?.id ?? '');
    if (!ids.includes(id) || out.some((t) => t.id === id)) continue;
    const theme = (THEMES as readonly string[]).includes(String(it.theme)) ? (String(it.theme) as Theme) : 'other';
    const markets = (Array.isArray(it.markets) ? it.markets : [])
      .map((m: Record<string, unknown>) => ({ market: String(m?.market || '').toUpperCase(), dir: m?.dir === 'down' ? 'down' as const : 'up' as const }))
      .filter((m: { market: string }) => MK.includes(m.market)).slice(0, 3);
    out.push({
      id, theme, markets,
      story: String(it.story || '').slice(0, 40) || 'Other news',
      tone: clampInt(it.tone, -2, 2, 0),
      speaker: it.speaker ? String(it.speaker).slice(0, 60) : null,
      trump: it.trump === true || theme === 'trump',
      impact: clampInt(it.impact, 1, 3, 1),
      chain: String(it.chain || '').slice(0, 140),
      short: String(it.short || '').slice(0, 32),
    });
  }
  return out;
}

/** Tags up to `max` untagged recent headlines. Called by the background refresh. */
export async function tagNews(max = 12): Promise<number> {
  if (!process.env.GEMINI_API_KEY) return 0;
  const q = await db();
  const rows = (await q`SELECT n.id, n.category, n.title, left(n.body, 400) AS body FROM mi_news n
    LEFT JOIN mi_news_tags t ON t.news_id = n.id
    WHERE t.news_id IS NULL AND n.published_at > now() - interval '4 days'
    ORDER BY n.published_at DESC LIMIT ${max}`) as { id: string; category: string; title: string; body: string }[];
  if (!rows.length) return 0;
  const text = await gemini(SYSTEM, JSON.stringify({ items: rows }), { json: true, maxTokens: 2500, timeoutMs: 40000 });
  const tags = cleanTags(parseJson(text), rows.map((r) => r.id));
  for (const t of tags) {
    await q`INSERT INTO mi_news_tags (news_id, story, theme, tone, speaker, trump, impact, markets, chain, short)
      VALUES (${t.id}, ${t.story}, ${t.theme}, ${t.tone}, ${t.speaker}, ${t.trump}, ${t.impact}, ${JSON.stringify(t.markets)}, ${t.chain}, ${t.short})
      ON CONFLICT (news_id) DO NOTHING`;
  }
  return tags.length;
}

export type FlowItem = Tag & { title: string; body: string; source: string | null; source_url: string | null; published_at: string; category: string };
export type ToneDay = { day: string; fed: number | null; fedN: number; war: number | null; warN: number };

/** Daily average tone for central banks and war over the last `days` days. */
export function toneStrip(items: Pick<FlowItem, 'theme' | 'tone' | 'published_at'>[], days = 30, now = Date.now()): ToneDay[] {
  const out: ToneDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
    const on = items.filter((x) => x.published_at.slice(0, 10) === day);
    const avg = (th: string) => { const v = on.filter((x) => x.theme === th).map((x) => x.tone); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
    out.push({ day, fed: avg('fed'), fedN: on.filter((x) => x.theme === 'fed').length, war: avg('war'), warN: on.filter((x) => x.theme === 'war').length });
  }
  return out;
}

export async function newsFlow(): Promise<{ items: FlowItem[]; tone: ToneDay[]; tagged: number }> {
  const q = await db();
  const rows = (await q`SELECT n.id, n.category, n.title, left(n.body, 500) AS body, n.source, n.source_url, n.published_at,
      t.story, t.theme, t.tone, t.speaker, t.trump, t.impact, t.markets, t.chain, t.short
    FROM mi_news n JOIN mi_news_tags t ON t.news_id = n.id
    WHERE n.published_at > now() - interval '30 days' AND t.impact > 0
    ORDER BY n.published_at DESC LIMIT 400`) as Record<string, unknown>[];
  const items = rows.map((r) => ({ ...(r as unknown as FlowItem), published_at: r.published_at instanceof Date ? r.published_at.toISOString() : String(r.published_at), markets: (r.markets as FlowItem['markets']) || [] }));
  return { items, tone: toneStrip(items), tagged: items.length };
}
