import { safeError } from '@/lib/http';
import { db, hasDb } from './db';
import { after } from 'next/server';
import { ensureRates, refreshMarketFeeds } from './marketfeed';

export type EventRow = { id: string; country: string; currency: string; name: string; impact: string; scheduled_at: string; what: string | null; why: string | null; markets: string[]; forecast: string | null; previous: string | null; source: string | null };
export type ResultRow = { event_id: string; country: string; name: string; actual: string; forecast: string | null; previous: string | null; verdict: string | null; surprise_score: number | null; simply: string | null; source: string; source_url: string | null; released_at: string };
export type NewsRow = { id: string; category: string; tag: string | null; title: string; body: string; reaction: string | null; source: string | null; source_url: string | null; published_at: string };
export type RateRow = { bank: string; currency: string; rate: string; last_change: string | null; last_change_date: string | null; next_meeting: string | null; source_url: string | null; updated_at: string };
export type LiveRow = { is_live: boolean; title: string | null; youtube_id: string | null; summary: string | null };

export type MarketData = { connected: boolean; events: EventRow[]; results: ResultRow[]; news: NewsRow[]; rates: RateRow[]; live: LiveRow | null; error?: string; feedStatus?: string };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

export async function loadMarketData(): Promise<MarketData> {
  if (!hasDb()) return { connected: false, events: [], results: [], news: [], rates: [], live: null };
  try {
    const q = await db();
    // Keep the page fresh on its own: refresh the calendar (every 30 min) and news (every 15 min) when stale.
    // Normally this runs after the page is sent; only a completely empty page waits for the first load.
    const refresh = () => refreshMarketFeeds(q).catch((e) => { problems.push(`feeds: ${safeError(e).slice(0, 160)}`); console.error('market feeds', safeError(e)); });
    const have = (await q`SELECT (SELECT count(*) FROM mi_events)::int AS e, (SELECT count(*) FROM mi_news)::int AS n, (SELECT count(*) FROM mi_rates)::int AS r`) as { e: number; n: number; r: number }[];
    const problems: string[] = [];
    if (!have[0]?.r) await ensureRates(q).catch((e) => { problems.push(`rates: ${safeError(e).slice(0, 160)}`); console.error('rates seed', safeError(e)); });
    if (!have[0]?.e || !have[0]?.n) await Promise.race([refresh(), new Promise((r) => setTimeout(r, 15000))]);
    else after(refresh);
    const [events, results, news, rates, live] = await Promise.all([
      q`SELECT * FROM mi_events WHERE scheduled_at >= now() - interval '12 hours' AND scheduled_at < now() + interval '8 days' ORDER BY scheduled_at LIMIT 200`,
      q`SELECT * FROM mi_results ORDER BY released_at DESC LIMIT 8`,
      q`SELECT * FROM mi_news ORDER BY published_at DESC LIMIT 30`,
      q`SELECT bank, currency, rate, last_change, to_char(last_change_date, 'YYYY-MM-DD') AS last_change_date, to_char(next_meeting, 'YYYY-MM-DD') AS next_meeting, source_url, updated_at FROM mi_rates ORDER BY bank`,
      q`SELECT * FROM mi_live WHERE id = 1`,
    ]);
    // Plain status shown under empty sections, so a problem is visible instead of silent.
    let feedStatus = problems.join(' · ');
    try {
      const st = (await q`SELECT key, ok, note, last_success FROM mq_feed_state ORDER BY key`) as { key: string; ok: boolean | null; note: string | null; last_success: string | null }[];
      const parts = st.map((r) => `${r.key}: ${r.ok === false ? `failed (${String(r.note || '').slice(0, 140)})` : r.last_success ? 'ok' : 'pending'}`);
      feedStatus = [feedStatus, ...parts].filter(Boolean).join(' · ');
    } catch (e) {
      feedStatus = [feedStatus, `status: ${safeError(e).slice(0, 120)}`].filter(Boolean).join(' · ');
    }
    return {
      feedStatus,
      connected: true,
      events: (events as EventRow[]).map((e) => ({ ...e, scheduled_at: iso(e.scheduled_at)!, markets: e.markets || [] })),
      results: (results as ResultRow[]).map((r) => ({ ...r, released_at: iso(r.released_at)! })),
      news: (news as NewsRow[]).map((n) => ({ ...n, published_at: iso(n.published_at)! })),
      rates: (rates as RateRow[]).map((r) => ({ ...r, last_change_date: iso(r.last_change_date), next_meeting: iso(r.next_meeting), updated_at: iso(r.updated_at)! })),
      live: (live as LiveRow[])[0] || null,
    };
  } catch (e) {
    console.error('market data', safeError(e));
    return { connected: false, events: [], results: [], news: [], rates: [], live: null, error: 'Market data is temporarily unavailable.', feedStatus: `load: ${safeError(e).slice(0, 200)}` };
  }
}
