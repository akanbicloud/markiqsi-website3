import { db, hasDb } from '@/lib/db';
import { fail, json, safeError } from '@/lib/http';
import { botAuthorized } from '@/lib/botauth';

export const maxDuration = 60;

/*
 * The market bot sends its data here: POST /api/bot/sync with header Authorization: Bearer <CRON_SECRET>.
 * Body (every part optional): { events: [], results: [], news: [], rates: [], live: {} }.
 * Rows that break the rules are skipped (never guessed or repaired) and counted in "skipped".
 */

type Obj = Record<string, unknown>;
const s = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).trim().slice(0, max));
const opt = (v: unknown, max = 500) => s(v, max) || null;
const isoTime = (v: unknown) => {
  const t = Date.parse(s(v, 40));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(s(v, 10)) ? s(v, 10) : null);
const url = (v: unknown) => (/^https?:\/\/\S+$/.test(s(v, 600)) ? s(v, 600) : null);

const COUNTRIES = ['US', 'UK', 'Eurozone', 'Japan', 'China', 'Canada', 'Australia', 'Global'];
const MARKETS = ['Forex', 'Stocks', 'Commodities', 'Crypto'];
const VERDICTS = ['Higher than expected', 'Lower than expected', 'As expected'];
const CATEGORIES = ['Geopolitics', 'Economy', 'Central banks', 'Commodities', 'Crypto'];
const BANKS = ['Federal Reserve', 'European Central Bank', 'Bank of England', 'Bank of Japan', 'Bank of Canada', 'Reserve Bank of Australia', "People's Bank of China"];
const MAX = 300;

export async function POST(req: Request) {
  if (!botAuthorized(req)) return fail('Not allowed', 401);
  if (!hasDb()) return fail('Database not connected', 503);
  let b: Obj;
  try {
    b = (await req.json()) as Obj;
  } catch {
    return fail('Body must be JSON');
  }
  const list = (k: string) => (Array.isArray(b[k]) ? (b[k] as Obj[]).slice(0, MAX) : []);
  const saved: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const skip = (k: string) => { skipped[k] = (skipped[k] || 0) + 1; };

  try {
    const q = await db();

    // ---- events (upcoming calendar)
    saved.events = 0;
    for (const e of list('events')) {
      const id = s(e.id, 120), country = s(e.country, 20), name = s(e.name, 160), impact = s(e.impact, 10), at = isoTime(e.scheduled_at);
      if (!id || !COUNTRIES.includes(country) || !name || !['High', 'Medium'].includes(impact) || !at || !s(e.currency, 5)) { skip('events'); continue; }
      const markets = (Array.isArray(e.markets) ? e.markets : []).map((m) => s(m, 20)).filter((m) => MARKETS.includes(m));
      await q`INSERT INTO mi_events (id, country, currency, name, impact, scheduled_at, what, why, markets, forecast, previous, source, updated_at)
        VALUES (${id}, ${country}, ${s(e.currency, 5)}, ${name}, ${impact}, ${at}, ${opt(e.what, 400)}, ${opt(e.why, 400)}, ${markets}, ${opt(e.forecast, 40)}, ${opt(e.previous, 40)}, ${opt(e.source, 120)}, now())
        ON CONFLICT (id) DO UPDATE SET country = EXCLUDED.country, currency = EXCLUDED.currency, name = EXCLUDED.name, impact = EXCLUDED.impact,
          scheduled_at = EXCLUDED.scheduled_at, what = EXCLUDED.what, why = EXCLUDED.why, markets = EXCLUDED.markets,
          forecast = EXCLUDED.forecast, previous = EXCLUDED.previous, source = EXCLUDED.source, updated_at = now()`;
      saved.events++;
    }

    // ---- results (only real released numbers)
    saved.results = 0;
    for (const r of list('results')) {
      const id = s(r.event_id, 120), country = s(r.country, 20), name = s(r.name, 160), actual = s(r.actual, 40), source = s(r.source, 120), at = isoTime(r.released_at);
      const verdict = opt(r.verdict, 40);
      const score = r.surprise_score == null ? null : Math.max(0, Math.min(10, Math.round(Number(r.surprise_score))));
      if (!id || !COUNTRIES.includes(country) || !name || !actual || !source || !at || (verdict && !VERDICTS.includes(verdict)) || (score != null && !Number.isFinite(score))) { skip('results'); continue; }
      await q`INSERT INTO mi_results (event_id, country, name, actual, forecast, previous, verdict, surprise_score, simply, source, source_url, released_at)
        VALUES (${id}, ${country}, ${name}, ${actual}, ${opt(r.forecast, 40)}, ${opt(r.previous, 40)}, ${verdict}, ${score}, ${opt(r.simply, 300)}, ${source}, ${url(r.source_url)}, ${at})
        ON CONFLICT (event_id) DO UPDATE SET actual = EXCLUDED.actual, forecast = EXCLUDED.forecast, previous = EXCLUDED.previous, verdict = EXCLUDED.verdict,
          surprise_score = EXCLUDED.surprise_score, simply = EXCLUDED.simply, source = EXCLUDED.source, source_url = EXCLUDED.source_url, released_at = EXCLUDED.released_at`;
      saved.results++;
    }

    // ---- news (keep 30 days)
    saved.news = 0;
    for (const n of list('news')) {
      const id = s(n.id, 120), category = s(n.category, 20), title = s(n.title, 300), bodyText = s(n.body, 700), at = isoTime(n.published_at);
      if (!id || !CATEGORIES.includes(category) || !title || !bodyText || !at || !url(n.source_url)) { skip('news'); continue; }
      await q`INSERT INTO mi_news (id, category, tag, title, body, reaction, source, source_url, published_at)
        VALUES (${id}, ${category}, ${opt(n.tag, 40)}, ${title}, ${bodyText}, ${opt(n.reaction, 300)}, ${opt(n.source, 80)}, ${url(n.source_url)}, ${at})
        ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, tag = EXCLUDED.tag, title = EXCLUDED.title, body = EXCLUDED.body,
          reaction = COALESCE(EXCLUDED.reaction, mi_news.reaction), source = EXCLUDED.source, source_url = EXCLUDED.source_url, published_at = EXCLUDED.published_at`;
      saved.news++;
    }
    if (saved.news) await q`DELETE FROM mi_news WHERE published_at < now() - interval '30 days'`;

    // ---- central bank rates (blank fields never wipe what is already stored)
    saved.rates = 0;
    for (const r of list('rates')) {
      const bank = s(r.bank, 60), rate = s(r.rate, 40);
      if (!BANKS.includes(bank) || !/\d/.test(rate) || !s(r.currency, 5)) { skip('rates'); continue; }
      await q`INSERT INTO mi_rates (bank, currency, rate, last_change, last_change_date, next_meeting, source_url, updated_at)
        VALUES (${bank}, ${s(r.currency, 5)}, ${rate}, ${opt(r.last_change, 40)}, ${isoDate(r.last_change_date)}, ${isoDate(r.next_meeting)}, ${url(r.source_url)}, now())
        ON CONFLICT (bank) DO UPDATE SET currency = EXCLUDED.currency, rate = EXCLUDED.rate,
          last_change = COALESCE(EXCLUDED.last_change, mi_rates.last_change),
          last_change_date = COALESCE(EXCLUDED.last_change_date, mi_rates.last_change_date),
          next_meeting = CASE WHEN EXCLUDED.next_meeting IS NOT NULL THEN EXCLUDED.next_meeting
                              WHEN mi_rates.next_meeting <= COALESCE(EXCLUDED.last_change_date, mi_rates.next_meeting - 1) THEN NULL
                              ELSE mi_rates.next_meeting END,
          source_url = COALESCE(EXCLUDED.source_url, mi_rates.source_url), updated_at = now()`;
      saved.rates++;
    }

    // ---- live central bank broadcast (single row)
    if (b.live && typeof b.live === 'object') {
      const l = b.live as Obj;
      const live = l.is_live === true;
      const yt = s(l.youtube_id, 20);
      if (live && !/^[A-Za-z0-9_-]{6,20}$/.test(yt)) skip('live');
      else {
        await q`INSERT INTO mi_live (id, is_live, title, youtube_id, summary, updated_at) VALUES (1, ${live}, ${live ? opt(l.title, 200) : null}, ${live ? yt : null}, ${live ? opt(l.summary, 1200) : null}, now())
          ON CONFLICT (id) DO UPDATE SET is_live = EXCLUDED.is_live, title = EXCLUDED.title, youtube_id = EXCLUDED.youtube_id, summary = EXCLUDED.summary, updated_at = now()`;
        saved.live = 1;
      }
    }

    // Old calendar entries are not needed once they are a week in the past.
    if (saved.events) await q`DELETE FROM mi_events WHERE scheduled_at < now() - interval '7 days'`;
    return json({ ok: true, saved, skipped });
  } catch (e) {
    console.error('bot sync', safeError(e));
    return json({ ok: false, error: 'Sync failed', detail: safeError(e), saved, skipped }, 500);
  }
}
