import type { Sql } from './db';
import { saveMarketData, type Obj } from './mistore';
import { safeError } from './http';

/*
 * The website's own market feed, so the Markets page works even when the Telegram bot is offline.
 *  - Calendar (this week + next week) from the ForexFactory weekly feed: High and Medium impact events
 *    for the US, UK, Eurozone, Japan, China, Canada and Australia (no Nigeria).
 *  - Central bank rates from rate-decision events in that calendar (previous = current rate before a meeting).
 *  - News headlines with their source link from well-known RSS feeds (geopolitics, economy, central banks,
 *    commodities, crypto).
 * Released results come from the bot (official BLS/FRED numbers). Nothing here is invented: a feed that
 * fails simply leaves the existing rows in place.
 */

const UA = 'Mozilla/5.0 (compatible; MarkIQ-SI/1.0; +https://www.markiqsi.com)';
const CAL_URLS = ['https://nfs.faireconomy.media/ff_calendar_thisweek.json', 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'];
const NEWS_FEEDS: [string, string][] = [
  ['CNBC', 'https://www.cnbc.com/id/10000664/device/rss/rss.html'],
  ['FXStreet', 'https://www.fxstreet.com/rss/news'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'],
  ['BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
];

const COUNTRY: Record<string, string> = { USD: 'US', GBP: 'UK', EUR: 'Eurozone', JPY: 'Japan', CNY: 'China', CAD: 'Canada', AUD: 'Australia' };
const MARKETS: Record<string, string[]> = {
  US: ['Forex', 'Stocks', 'Commodities', 'Crypto'], China: ['Forex', 'Stocks', 'Commodities'], Canada: ['Forex', 'Commodities'],
  Australia: ['Forex', 'Commodities'], UK: ['Forex', 'Stocks'], Eurozone: ['Forex', 'Stocks'], Japan: ['Forex', 'Stocks'],
};

const EXPLAIN: [string[], string, string][] = [
  [['core pce'], "The Fed's favourite measure of underlying inflation.", "It guides the Fed's interest-rate decisions."],
  [['cpi', 'consumer price', 'inflation rate', 'hicp'], 'How fast prices for everyday goods and services are rising.', 'Inflation decides what the central bank does with interest rates, so a surprise moves the currency, gold and stocks.'],
  [['ppi', 'producer price'], 'How fast prices are rising for businesses.', 'It often shows up later in consumer prices, so it hints at future inflation.'],
  [['non-farm', 'nonfarm', 'employment change'], 'How many jobs were added last month.', 'Strong hiring can keep interest rates high; weak hiring can bring cuts.'],
  [['average hourly earnings', 'wage'], 'How fast pay is rising.', 'Fast pay growth can keep inflation and interest rates high.'],
  [['unemployment rate', 'jobless rate'], 'The share of people who want a job but cannot find one.', 'A weaker job market can push the central bank to cut rates.'],
  [['unemployment claims', 'jobless claims', 'claimant count'], 'How many people applied for jobless benefits.', 'An early, weekly sign of how the job market is doing.'],
  [['gdp'], 'How fast the whole economy grew.', 'It shows whether the economy is strong or slowing. Big surprises move the currency and stocks.'],
  [['retail sales'], 'How much people spent in shops and online.', 'Spending drives most of the economy, so it hints at growth and future rates.'],
  [['pmi', 'ism', 'purchasing managers'], 'A business survey: above 50 means growing, below 50 means shrinking.', 'One of the first signs each month of where the economy is heading.'],
  [['rate decision', 'funds rate', 'bank rate', 'cash rate', 'overnight rate', 'policy rate', 'refinancing rate', 'deposit facility', 'loan prime'], "The central bank's decision on its main interest rate.", 'Interest rates move currencies more than anything else. Higher rates usually make a currency stronger.'],
  [['press conference', 'speaks', 'testifies', 'statement', 'minutes'], 'Comments from central bank leaders about the economy and rates.', 'Hints about future rate moves can move the currency even with no new numbers.'],
  [['trade balance', 'current account'], 'The difference between what a country sells abroad and what it buys.', 'It affects demand for the currency over time.'],
];

const RATE_EVENTS: [string, string[], string, string][] = [
  ['US', ['federal funds rate'], 'Federal Reserve', 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm'],
  ['Eurozone', ['deposit facility rate', 'main refinancing rate'], 'European Central Bank', 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html'],
  ['UK', ['official bank rate', 'bank rate'], 'Bank of England', 'https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate'],
  ['Japan', ['boj policy rate', 'policy rate'], 'Bank of Japan', 'https://www.boj.or.jp/en/mopo/index.htm'],
  ['Canada', ['overnight rate'], 'Bank of Canada', 'https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/'],
  ['Australia', ['cash rate'], 'Reserve Bank of Australia', 'https://www.rba.gov.au/statistics/cash-rate/'],
  ['China', ['1-y loan prime rate', 'loan prime rate'], "People's Bank of China", 'http://www.pbc.gov.cn/en/3688006/index.html'],
];

export const slug = (t: string, n = 40) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n);

export function parseNumber(v: unknown): number | null {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([KMBT]?)/i);
  if (!m) return null;
  const mult: Record<string, number> = { '': 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return parseFloat(m[1]) * mult[m[2].toUpperCase()];
}

export function explain(name: string): [string | null, string | null] {
  const low = name.toLowerCase();
  for (const [keys, what, why] of EXPLAIN) if (keys.some((k) => low.includes(k))) return [what, why];
  return [null, null];
}

type FFItem = { title?: string; country?: string; date?: string; impact?: string; forecast?: string; previous?: string; actual?: string };

/** ForexFactory weekly JSON -> website events and rates. Pure (tested). */
export function calendarPayload(items: FFItem[], now = new Date()): { events: Obj[]; rates: Obj[] } {
  const events: Obj[] = [];
  const rates = new Map<string, Obj & { _at: number; _key: string }>();
  for (const it of items) {
    const country = COUNTRY[String(it.country || '').toUpperCase()];
    const impact = String(it.impact || '');
    const name = String(it.title || '').trim();
    if (!country || !['High', 'Medium'].includes(impact) || !name || !it.date) continue;
    const at = new Date(it.date);
    if (!Number.isFinite(at.getTime())) continue;
    // All-day / tentative items are published at local midnight: not a timed release.
    if (/T00:00:00/.test(it.date)) continue;
    const stamp = at.toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const [what, why] = explain(name);
    const forecast = (it.forecast || '').trim() || null;
    const previous = (it.previous || '').trim() || null;
    const actual = (it.actual || '').trim() || null;
    events.push({
      id: `${country.toLowerCase()}-${slug(name)}-${stamp}`, country, currency: String(it.country).toUpperCase(), name, impact,
      scheduled_at: at.toISOString(), what, why, markets: MARKETS[country], forecast, previous, source: 'ForexFactory economic calendar',
    });

    const low = name.toLowerCase();
    for (const [rc, keys, bank, bankUrl] of RATE_EVENTS) {
      if (rc !== country || !keys.some((k) => low.includes(k))) continue;
      if (/statement|minutes|press|vote|speaks|projection/.test(low)) break;
      const key = keys.find((k) => low.includes(k))!;
      const cur = rates.get(bank);
      if (cur && cur._key === 'deposit facility rate' && low.includes('main refinancing')) break;
      const prevN = parseNumber(previous);
      const actN = parseNumber(actual);
      const t = at.getTime();
      if (actual && actN != null && t <= now.getTime()) {
        let change: string | null = null;
        if (prevN != null) {
          const d = Math.round((actN - prevN) * 10000) / 10000;
          change = Math.abs(d) < 1e-9 ? 'Hold' : d > 0 ? `Raised ${d.toFixed(2)}%` : `Cut ${Math.abs(d).toFixed(2)}%`;
        }
        if (!cur || cur._at <= t) rates.set(bank, { bank, currency: String(it.country).toUpperCase(), rate: `${actN.toFixed(2)}%`, last_change: change, last_change_date: at.toISOString().slice(0, 10), next_meeting: null, source_url: bankUrl, _at: t, _key: key });
      } else if (!actual && prevN != null && t > now.getTime()) {
        if (!cur || (cur.next_meeting && (cur._at > t || (cur._at === t && key === 'deposit facility rate'))))
          rates.set(bank, { bank, currency: String(it.country).toUpperCase(), rate: `${prevN.toFixed(2)}%`, last_change: null, last_change_date: null, next_meeting: at.toISOString().slice(0, 10), source_url: bankUrl, _at: t, _key: key });
      }
      break;
    }
  }
  return { events, rates: [...rates.values()].map(({ _at, _key, ...r }) => r) };
}

// ---------------------------------------------------------------- news

const GEO = ['war', 'military', 'missile', 'airstrike', 'troops', 'invasion', 'ceasefire', 'sanction', 'tariff', 'embargo', 'election', 'coup', 'nato', 'hormuz', 'red sea', 'opec+', 'trade war', 'geopolit', 'conflict', 'attack', 'nuclear'];
const REGIONS: [string[], string][] = [
  [['iran', 'israel', 'gaza', 'yemen', 'houthi', 'saudi', 'middle east', 'hormuz', 'red sea', 'lebanon', 'syria'], 'Middle East'],
  [['russia', 'ukraine', 'kyiv', 'moscow'], 'Russia-Ukraine'],
  [['china', 'taiwan', 'beijing', 'south china sea'], 'China'],
  [['tariff', 'trade war', 'trade deal'], 'Trade'],
  [['election', 'vote', 'parliament'], 'Elections'],
];
const word = (text: string, w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);

export function categorize(title: string, body: string): [string, string | null] {
  const t = `${title} ${body}`.toLowerCase();
  if (GEO.some((w) => word(t, w) || (w.length > 6 && t.includes(w)))) return ['Geopolitics', REGIONS.find(([ks]) => ks.some((k) => t.includes(k)))?.[1] || 'World'];
  if (['bitcoin', 'crypto', 'ether', 'btc', 'stablecoin', 'blockchain', 'solana'].some((w) => word(t, w))) return ['Crypto', null];
  if (['fed', 'federal reserve', 'ecb', 'bank of england', 'boe', 'bank of japan', 'boj', 'central bank', 'rate cut', 'rate hike', 'interest rate', 'powell', 'lagarde', 'bailey', 'ueda'].some((w) => word(t, w))) return ['Central banks', null];
  if (['oil', 'crude', 'gold', 'silver', 'copper', 'opec', 'natural gas', 'brent', 'wti', 'commodities'].some((w) => word(t, w))) return ['Commodities', null];
  return ['Economy', null];
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};
async function sha(text: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** RSS XML -> website news rows (pure except hashing). Geopolitics-only feeds keep only geopolitics items. */
export async function newsFromRss(source: string, xml: string, now = new Date(), geoOnly = false): Promise<Obj[]> {
  const out: Obj[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const title = tag(item, 'title');
    const link = tag(item, 'link') || (item.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
    const pub = new Date(tag(item, 'pubDate') || tag(item, 'dc:date'));
    let body = tag(item, 'description');
    if (!title || !/^https?:\/\//.test(link) || !Number.isFinite(pub.getTime())) continue;
    if (now.getTime() - pub.getTime() > 48 * 3600e3 || pub.getTime() - now.getTime() > 3600e3) continue;
    if (/nigeria/i.test(`${title} ${body}`)) continue;
    const sentences = body.match(/[^.!?]+[.!?]+/g) || (body ? [body] : []);
    body = sentences.slice(0, 2).map((x) => x.trim()).join(' ').slice(0, 400);
    if (!body || body.toLowerCase() === title.toLowerCase()) continue;
    const [category, tg] = categorize(title, body);
    if (geoOnly && category !== 'Geopolitics') continue;
    out.push({ id: `n-${await sha(link)}`, category, tag: tg, title: title.slice(0, 300), body, reaction: null, source, source_url: link, published_at: pub.toISOString() });
  }
  return out;
}

async function get(url: string, ms = 6000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(ms), cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).hostname}`);
  return r;
}

// ---------------------------------------------------------------- refresh

/** Atomically claims a refresh slot so many visitors never trigger many downloads. */
async function claim(q: Sql, key: string, everyMinutes: number) {
  const rows = (await q`
    INSERT INTO mq_feed_state (key, fetched_at) VALUES (${key}, now())
    ON CONFLICT (key) DO UPDATE SET fetched_at = now()
    WHERE mq_feed_state.fetched_at < now() - make_interval(mins => ${everyMinutes})
    RETURNING key`) as unknown[];
  return rows.length > 0;
}

async function note(q: Sql, key: string, ok: boolean, msg: string, retryMinutes?: number) {
  // On failure, allow a retry sooner than the normal interval.
  if (!ok && retryMinutes != null) await q`UPDATE mq_feed_state SET ok = false, note = ${msg}, fetched_at = now() - make_interval(mins => ${retryMinutes}) WHERE key = ${key}`;
  else await q`UPDATE mq_feed_state SET ok = ${ok}, note = ${msg} WHERE key = ${key}`;
}

export async function refreshCalendar(q: Sql, force = false) {
  if (!force && !(await claim(q, 'calendar', 30))) return null;
  try {
    const items: FFItem[] = [];
    for (const u of CAL_URLS) {
      try {
        const d = await (await get(u)).json();
        if (Array.isArray(d)) items.push(...d);
      } catch (e) {
        if (u === CAL_URLS[0]) throw e; // next week is optional
      }
    }
    const res = await saveMarketData(q, calendarPayload(items));
    await note(q, 'calendar', true, JSON.stringify(res.saved));
    return res;
  } catch (e) {
    console.error('calendar feed', safeError(e));
    await note(q, 'calendar', false, safeError(e), 25);
    return null;
  }
}

export async function refreshNews(q: Sql, force = false) {
  if (!force && !(await claim(q, 'news', 15))) return null;
  const results = await Promise.allSettled(NEWS_FEEDS.map(async ([name, u]) => newsFromRss(name, await (await get(u)).text(), new Date(), name === 'BBC News')));
  const news = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const failed = results.map((r, i) => (r.status === 'rejected' ? NEWS_FEEDS[i][0] : null)).filter(Boolean);
  try {
    const res = news.length ? await saveMarketData(q, { news }) : { saved: { news: 0 }, skipped: {} };
    await note(q, 'news', news.length > 0, `saved ${res.saved.news ?? 0}${failed.length ? `; failed: ${failed.join(', ')}` : ''}`, news.length ? undefined : 10);
    return res;
  } catch (e) {
    console.error('news feed', safeError(e));
    await note(q, 'news', false, safeError(e), 10);
    return null;
  }
}

/** Refreshes whatever is stale, but never makes a page wait longer than `budgetMs`. */
export async function refreshMarketFeeds(q: Sql, budgetMs = 7000) {
  const work = Promise.allSettled([refreshCalendar(q), refreshNews(q)]);
  await Promise.race([work, new Promise((r) => setTimeout(r, budgetMs))]);
}
