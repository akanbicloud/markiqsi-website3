import { db } from './db';
import { ASSETS, type Asset } from './assets';
import { COMPANY, SITE } from './site';
import { ACADEMY, COURSES, money } from './content/courses';
import { gemini, parseJson } from './gemini';

/**
 * Ask MarkIQ: one answer engine for the website and the Telegram bot.
 * - Concepts, education and "how does X work" are answered from general trading knowledge.
 * - Anything live (prices, rates, results, events, news, dates) comes ONLY from our data tables;
 *   price-like numbers that are not in the data are removed from the answer.
 * - Questions about MarkIQ SI (courses, prices, address, tools) come from the site's own facts.
 */

export type Turn = { q: string; a: string };
export type AskAnswer = {
  answer: string;
  facts: string[];
  watch: string[];
  followUps: string[];
  topic: 'market' | 'education' | 'platform' | 'other';
  missing: string;
  assets: string[];
  sources: string[];
};

const SYMBOL_FOR: Record<string, string> = { 'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY', 'AUD/USD': 'AUDUSD', 'USD/CAD': 'USDCAD', Gold: 'XAUUSD', Oil: 'WTI', Bitcoin: 'BTCUSD', 'S&P 500': 'SPY' };

const KEYWORDS: [string, RegExp][] = [
  ['EUR/USD', /\b(eur\s*\/?\s*usd|euro|fiber|eurusd)\b/i],
  ['GBP/USD', /\b(gbp\s*\/?\s*usd|cable|pound|sterling|gbpusd|gbp)\b/i],
  ['USD/JPY', /\b(usd\s*\/?\s*jpy|yen|usdjpy|jpy)\b/i],
  ['AUD/USD', /\b(aud\s*\/?\s*usd|aussie|audusd|aud)\b/i],
  ['USD/CAD', /\b(usd\s*\/?\s*cad|loonie|usdcad|cad)\b/i],
  ['Gold', /\b(gold|xau|xauusd|xau\s*\/\s*usd)\b/i],
  ['Oil', /\b(oil|wti|crude|brent|usoil)\b/i],
  ['Bitcoin', /\b(bitcoin|btc|btcusd|crypto)\b/i],
  ['S&P 500', /(s&p|\bspx\b|\bspy\b|\bus500\b|\bnasdaq\b|\bstocks?\b|\bindices\b|\bdow\b)/i],
];

export function detectAssets(question: string, focus?: string | null): Asset[] {
  const keys = new Set<string>();
  if (focus) keys.add(focus);
  for (const [k, re] of KEYWORDS) if (re.test(question)) keys.add(k);
  return ASSETS.filter((a) => keys.has(a.key)).slice(0, 3);
}

const PLATFORM_HINT = /\b(markiq|course|courses|class|classes|academy|price of|how much|fee|fees|enrol|enroll|register|sign ?up|physical|online|address|location|where are you|contact|whatsapp|phone|email|bot builder|indicator builder|scanner|journal|telegram|tool|tools|founder|naheem|owner)\b/i;

export function platformFacts() {
  return {
    name: 'MarkIQ SI (Market Intelligence & Academy)',
    website: SITE.url,
    founder: `${COMPANY.founder.name}: ${COMPANY.founder.bio}`,
    academy: { address: ACADEMY.addressLine, physical_classes_started: COMPANY.academyOpened },
    contact: { email: SITE.email, phone_whatsapp: SITE.phoneIntl, telegram_channel: SITE.telegram, instagram: SITE.instagram, x: SITE.x },
    courses: COURSES.map((c) => ({
      title: c.title, level: c.level, weeks: c.weeks, link: `${SITE.url}/courses/${c.slug}`,
      online: `${money(c.price.onlineNgn, 'NGN')} or ${money(c.price.onlineUsd, 'USD')}`, physical: money(c.price.physicalNgn, 'NGN'),
      summary: c.short, ...(c.bundle ? { includes: c.bundle } : {}),
    })),
    free_tools: ['Chart Analysis (upload a chart screenshot)', 'Market Scanner', 'Charts with bar replay', 'Indicator Builder (TradingView and MT5)', 'Bot Builder with backtesting (MT5 and TradingView)', 'Risk Calculator', 'Prop Challenge Tracker', 'Trading Journal', 'Markets page with events, results, rates and news', 'Telegram alerts'],
    tools_link: `${SITE.url}/tools`,
    policies: 'Market information and tools are free with daily limits. Courses are paid. MarkIQ SI never takes deposits, never manages money, never asks for trading passwords, does not sell signals and never promises profit.',
    press: COMPANY.press.map((p) => `${p.title} (${p.outlet}, ${p.date})`),
  };
}

const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));

async function priceSnapshot(q: Awaited<ReturnType<typeof db>>, asset: Asset) {
  const sym = SYMBOL_FOR[asset.key];
  if (!sym) return null;
  const [fast, daily] = await Promise.all([
    q`SELECT t, c FROM mq_history WHERE symbol = ${sym} AND timeframe IN ('15min', '1h') ORDER BY t DESC LIMIT 1`,
    q`SELECT t, o, h, l, c FROM mq_history WHERE symbol = ${sym} AND timeframe = '1day' ORDER BY t DESC LIMIT 6`,
  ]) as [{ t: string; c: number }[], { t: string; o: number; h: number; l: number; c: number }[]];
  const last = fast[0] || daily[0];
  if (!last) return null;
  const d = daily.map((x) => ({ date: new Date(Number(x.t)).toISOString().slice(0, 10), open: Number(x.o), high: Number(x.h), low: Number(x.l), close: Number(x.c) }));
  return {
    market: asset.label,
    last_price: Number(last.c),
    as_of_utc: new Date(Number(last.t)).toISOString().slice(0, 16).replace('T', ' '),
    recent_days: d.reverse(),
  };
}

export async function gatherData(question: string, assets: Asset[]) {
  const q = await db();
  const currencies = [...new Set(assets.flatMap((a) => a.currencies))];
  const countries = [...new Set(assets.flatMap((a) => a.countries))];
  const scoped = assets.length > 0;
  const [events, results, rates, news, reactions, prices] = await Promise.all([
    scoped
      ? q`SELECT country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE scheduled_at > now() - interval '2 hours' AND scheduled_at < now() + interval '8 days' AND (currency = ANY(${currencies}) OR country = ANY(${countries})) ORDER BY scheduled_at LIMIT 20`
      : q`SELECT country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE scheduled_at > now() - interval '2 hours' AND scheduled_at < now() + interval '8 days' AND impact ILIKE 'high%' ORDER BY scheduled_at LIMIT 25`,
    scoped
      ? q`SELECT country, name, actual, forecast, previous, verdict, source, released_at FROM mi_results WHERE country = ANY(${countries}) AND released_at > now() - interval '45 days' ORDER BY released_at DESC LIMIT 12`
      : q`SELECT country, name, actual, forecast, previous, verdict, source, released_at FROM mi_results WHERE released_at > now() - interval '21 days' ORDER BY released_at DESC LIMIT 15`,
    q`SELECT bank, currency, rate, last_change, to_char(last_change_date, 'YYYY-MM-DD') AS last_change_date, to_char(next_meeting, 'YYYY-MM-DD') AS next_meeting FROM mi_rates ORDER BY bank`,
    q`SELECT category, tag, title, left(body, 280) AS body, reaction, source, published_at FROM mi_news WHERE published_at > now() - interval '3 days' ORDER BY published_at DESC LIMIT 12`,
    scoped
      ? q`SELECT event_name, released_at, actual, forecast, previous, surprise, asset, move_15m, move_1h, move_1d FROM mi_reactions WHERE asset ILIKE ANY(${assets.flatMap((a) => [`%${a.key}%`, `%${a.key.replace('/', '')}%`, ...(a.key === 'Gold' ? ['%XAU%'] : [])])}) ORDER BY released_at DESC LIMIT 40`
      : Promise.resolve([]),
    Promise.all(assets.map((a) => priceSnapshot(q, a).catch(() => null))),
  ]);
  return {
    now_utc: new Date().toISOString().slice(0, 16).replace('T', ' '),
    focus_markets: assets.map((a) => ({ market: a.label, background: a.simply, drivers: a.drivers })),
    prices: (prices as unknown[]).filter(Boolean),
    upcoming_events: clean(events as Record<string, unknown>[]),
    latest_official_results: clean(results as Record<string, unknown>[]),
    central_bank_rates: clean(rates as Record<string, unknown>[]),
    recent_news: clean(news as Record<string, unknown>[]),
    past_reactions: clean(reactions as Record<string, unknown>[]),
    markiq_si: PLATFORM_HINT.test(question) || !assets.length ? platformFacts() : { website: SITE.url, courses_link: `${SITE.url}/courses`, tools_link: `${SITE.url}/tools` },
  };
}

export const SYSTEM = `You are Ask MarkIQ, the expert market mentor of MarkIQ SI (a trading academy and market intelligence platform in Abeokuta, Nigeria).
You answer like a senior trader and teacher: direct, accurate, practical, and kind to beginners.

How to answer:
- Answer the exact question in the FIRST sentence. Then explain why, with the most useful detail. Use short paragraphs; use "- " bullets for lists or steps.
- Concepts, definitions, strategies, history, how markets and economic data work, risk management, psychology, platforms: answer fully from your own trading knowledge (pips, lots, leverage, ICT/SMC, supply and demand, indicators, sessions, central banks, prop firms, MT5, TradingView...).
- Past reactions ("what happened to gold when CPI was higher than expected?"): use DATA.past_reactions, which are real measured moves. Count the cases, say how many went up vs down and the typical size, name the most recent one with its date, and say that past reactions do not guarantee the next one. If there are fewer than 3 matching cases, say the sample is small.
- Anything CURRENT (today's prices, current interest rates, latest results, upcoming events, recent news, dates and times): use ONLY DATA. Give the date/time and source. If DATA does not have it, say plainly that you do not have it in our live data yet, then still explain what generally matters and point to ${SITE.url}/markets.
- Never invent a current price, rate, result, forecast or date. Never quote a price level that is not in DATA.
- Questions about MarkIQ SI (courses, prices, classes, address, contact, tools, policies): use DATA.markiq_si exactly.
- "Should I buy/sell?", "where will price go?": no signals or predictions. Give the bullish and bearish case from DATA, the levels/conditions to watch, and the risk rules. You may say which way the evidence currently leans and why.
- If the question is unclear, answer the most likely meaning and offer the other meaning in followUps.
- Use the conversation so far for follow-ups ("it", "that pair", "and the yen?").
- Length: 60-220 words for "answer". Plain English. No hype, no emojis.
Return JSON only: {"answer": string, "facts": [string] (live facts from DATA you used, each with date and source; [] if none), "watch": [string] (upcoming events or levels from DATA worth watching; [] if none), "followUps": [string] (3 short natural next questions), "topic": "market"|"education"|"platform"|"other", "missing": string (live data you lacked, or "")}`;

const PRICE_NUM = /\d[\d,]*\.\d{3,}/g;

/** Removes sentences containing a price-like number (3+ decimals, 0.01 or more) that is not in DATA. */
export function groundPrices(text: string, data: unknown): string {
  const hay = JSON.stringify(data);
  const known = new Set((hay.match(/\d+\.\d+/g) || []).map((x) => Number(x)));
  const ok = (s: string) => (s.match(PRICE_NUM) || []).every((n) => {
    const v = Number(n.replace(/,/g, ''));
    if (Math.abs(v) < 0.01) return true; // pip sizes and tick values (0.0001), not price levels
    for (const k of known) if (Math.abs(k - v) < 1e-9 || (k !== 0 && Math.abs(k - v) / Math.abs(k) < 2e-5)) return true;
    return false;
  });
  return text
    .split('\n')
    .map((line) => line.split(/(?<=[.!?])\s+/).filter(ok).join(' '))
    .filter((line, i, arr) => line.trim() || (i > 0 && arr[i - 1].trim()))
    .join('\n')
    .trim();
}

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const strs = (v: unknown, k: number, n = 240) => (Array.isArray(v) ? v.slice(0, k).map((x) => str(x, n)).filter(Boolean) : []);

export async function answerQuestion(input: { question: string; focus?: string | null; history?: Turn[] }): Promise<AskAnswer> {
  const question = input.question.trim();
  const history = (input.history || []).slice(-3).map((t) => ({ q: str(t.q, 400), a: str(t.a, 700) }));
  // follow-ups like "and gold?" keep the markets from earlier turns
  let assets = detectAssets(question, input.focus);
  if (!assets.length && history.length) assets = detectAssets(history.map((h) => h.q).join(' '), null);
  const data = await gatherData(question, assets);
  const convo = history.length ? `CONVERSATION SO FAR:\n${history.map((h) => `User: ${h.q}\nMarkIQ: ${h.a}`).join('\n')}\n\n` : '';
  const user = `${convo}QUESTION: ${question}\n\nDATA: ${JSON.stringify(data)}`;
  const text = await gemini(SYSTEM, user, { json: true, maxTokens: 1400, timeoutMs: 40000 });
  const a = parseJson<Record<string, unknown>>(text);
  if (!a || !a.answer) throw new Error('The AI answer was incomplete');
  const answer = groundPrices(str(a.answer, 2400), data);
  if (!answer) throw new Error('The AI answer could not be checked against our data');
  const topic = (['market', 'education', 'platform', 'other'] as const).find((t) => t === a.topic) || 'other';
  const sources = new Set<string>();
  for (const r of data.latest_official_results as { source?: string }[]) if (r.source) sources.add(String(r.source));
  for (const n of data.recent_news as { source?: string }[]) if (n.source) sources.add(String(n.source));
  for (const x of assets) for (const s of x.sources) sources.add(s);
  return {
    answer,
    facts: strs(a.facts, 6).map((f) => groundPrices(f, data)).filter(Boolean),
    watch: strs(a.watch, 5).map((f) => groundPrices(f, data)).filter(Boolean),
    followUps: strs(a.followUps, 3, 120),
    topic,
    missing: str(a.missing, 300),
    assets: assets.map((x) => x.label),
    sources: topic === 'education' || topic === 'platform' ? [] : [...sources].slice(0, 8),
  };
}

