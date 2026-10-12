import { db, hasDb } from '@/lib/db';
import { body, fail, json, safeError, str } from '@/lib/http';
import { gemini, parseJson } from '@/lib/gemini';
import { takeQuota, quotaMessage } from '@/lib/usage';
import { ASSETS } from '@/lib/assets';
import { getHistory } from '@/lib/trading/history';
import { digitsFor } from '@/lib/trading/prices';
import { analyzeStructure } from '@/lib/trading/structure';
import { TF_KEYS, TIMEFRAMES, findSymbol, type TF } from '@/lib/trading/symbols';

export const maxDuration = 60;

const ASSET_FOR: Record<string, string> = { EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD', XAUUSD: 'Gold', WTI: 'Oil', BTCUSD: 'Bitcoin', SPY: 'S&P 500' };
const COUNTRY: Record<string, string> = { USD: 'US', EUR: 'Eurozone', GBP: 'UK', JPY: 'Japan', AUD: 'Australia', CAD: 'Canada', CHF: 'Switzerland', NZD: 'New Zealand', CNY: 'China' };
const MAX_IMAGE = 3_500_000; // base64 characters (about 2.6 MB image)

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

const SYSTEM = `You are MarkIQ SI Chart Review, an educational chart explainer for a trading academy.
You get a trader's chart screenshot plus DATA computed from real price data and official economic data.
Rules you must follow:
- Describe what you can see on the screenshot (drawings, zones, patterns, indicators) in plain words.
- Every price level you state MUST come from DATA (structure.support, structure.resistance, structure.swings, range20, EMAs). Never read exact prices off the image and never invent numbers.
- If the screenshot clearly does not look like the market or timeframe the trader selected (for example a very different price scale), set "matches" to false and explain in "mismatch".
- Fundamentals: use ONLY facts in DATA.fundamentals (events, results, rates). If there is nothing, say there is no major scheduled news in our data.
- Give two or three possible scenarios with a clear condition and an invalidation level from DATA. Say which scenario the evidence leans toward and why, in one sentence. This is a possible direction, not advice: never say "buy now", "sell now" or give position sizes, and never promise an outcome.
- Plain, simple English. Short sentences.
Return JSON only: {"seen": [string], "matches": boolean, "mismatch": string, "structure": [string], "levels": {"support": [string], "resistance": [string]}, "fundamentals": [string], "scenarios": [{"bias": "Bullish"|"Bearish"|"Neutral", "when": string, "invalidation": string, "watchFor": string}], "leaning": string, "watch": [string], "caution": string}`;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return fail('Chart analysis is being set up. Please check back soon.', 503);
  if (!hasDb() || !process.env.TWELVE_DATA_API_KEY) return fail('Chart analysis needs price data, which is not connected yet.', 503);
  const b = await body(req);
  const sym = findSymbol(str(b.symbol, 20));
  const tf = str(b.tf, 10) as TF;
  const question = str(b.question, 300);
  const image = str(b.image, MAX_IMAGE + 100);
  if (!sym) return fail('Please choose the market shown on your chart.');
  if (!TF_KEYS.includes(tf)) return fail('Please choose the chart timeframe.');
  const m = image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return fail('Please add a PNG, JPG or WebP screenshot of your chart.');
  if (m[2].length > MAX_IMAGE) return fail('That image is too large. Please use a smaller screenshot.');

  const quota = await takeQuota(req, 'chart');
  if (!quota.ok) return fail(quotaMessage(quota, 'chart analyses'), 429);

  try {
    const { candles } = await getHistory(sym, tf, null, 600);
    const structure = analyzeStructure(candles, digitsFor(sym));
    if (!structure) return fail('Not enough price history for this market and timeframe yet. Try a higher timeframe.');

    const q = await db();
    const countries = sym.currencies.map((c) => COUNTRY[c]).filter(Boolean);
    const [events, results, rates] = await Promise.all([
      q`SELECT country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE scheduled_at > now() AND scheduled_at < now() + interval '7 days' AND (currency = ANY(${sym.currencies}) OR country = ANY(${countries})) ORDER BY scheduled_at LIMIT 10`,
      q`SELECT country, name, actual, forecast, previous, verdict, source, released_at FROM mi_results WHERE country = ANY(${countries}) AND released_at > now() - interval '30 days' ORDER BY released_at DESC LIMIT 10`,
      q`SELECT bank, currency, rate, to_char(last_change_date, 'YYYY-MM-DD') AS last_change_date, to_char(next_meeting, 'YYYY-MM-DD') AS next_meeting FROM mi_rates WHERE currency = ANY(${sym.currencies})`,
    ]).catch(() => [[], [], []]);
    const asset = ASSETS.find((a) => a.key === ASSET_FOR[sym.key]);
    const tfLabel = TIMEFRAMES.find((t) => t.key === tf)?.label || tf;
    const data = {
      market: sym.label,
      timeframe: tfLabel,
      structure,
      fundamentals: { upcoming_events: events, latest_results: results, central_bank_rates: rates, background_drivers: asset?.drivers || [] },
    };
    const user = `The trader says this chart is ${sym.label} on the ${tfLabel} timeframe.${question ? ` Their question: ${question}` : ''}\n\nDATA: ${JSON.stringify(data)}`;
    const text = await gemini(SYSTEM, user, { json: true, maxTokens: 1600, images: [{ mime: m[1], data: m[2] }], timeoutMs: 50000 });
    const a = parseJson<ChartAnalysis>(text);
    if (!a || !Array.isArray(a.scenarios)) throw new Error('bad answer');
    const s = (v: unknown, n = 300) => String(v ?? '').slice(0, n);
    const list = (v: unknown, k = 6) => (Array.isArray(v) ? v.slice(0, k).map((x) => s(x)) : []);
    return json({
      ok: true,
      market: sym.label,
      timeframe: tfLabel,
      structure,
      analysis: {
        seen: list(a.seen),
        matches: a.matches !== false,
        mismatch: s(a.mismatch),
        structure: list(a.structure),
        levels: { support: list(a.levels?.support, 3), resistance: list(a.levels?.resistance, 3) },
        fundamentals: list(a.fundamentals),
        scenarios: a.scenarios.slice(0, 3).map((x) => ({ bias: ['Bullish', 'Bearish', 'Neutral'].includes(x.bias) ? x.bias : 'Neutral', when: s(x.when), invalidation: s(x.invalidation), watchFor: s(x.watchFor) })),
        leaning: s(a.leaning),
        watch: list(a.watch),
        caution: s(a.caution),
      },
      remaining: quota.remaining,
    });
  } catch (e) {
    console.error('chart analysis', safeError(e));
    const msg = (e as Error).message;
    return fail(/credit|limit/i.test(msg) ? 'Our price data limit is busy. Please try again in a minute.' : 'The chart could not be analysed just now. Please try again in a minute.', 502);
  }
}
