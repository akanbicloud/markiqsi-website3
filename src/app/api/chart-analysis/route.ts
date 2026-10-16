import { db, hasDb } from '@/lib/db';
import { body, fail, json, safeError, str } from '@/lib/http';
import { gemini, parseJson } from '@/lib/gemini';
import { refundQuota, takeQuota, quotaMessage } from '@/lib/usage';
import { ASSETS } from '@/lib/assets';
import { getHistory } from '@/lib/trading/history';
import { digitsFor } from '@/lib/trading/prices';
import { analyzeStructure, type StructureSummary } from '@/lib/trading/structure';
import { allowedNumbers, cleanAnalysis, fromData, type ChartAnalysis } from '@/lib/trading/chartreview';
import { buildChecks, buildPlans, buildZones, evidenceOf, htfView, newsWithin, rateGapOf, type Brain } from '@/lib/trading/chartbrain';
import { closedOnly } from '@/lib/trading/prices';
import type { Candle } from '@/lib/trading/indicators';
import { TF_KEYS, TIMEFRAMES, findSymbol, type TF } from '@/lib/trading/symbols';

export const maxDuration = 60;

const ASSET_FOR: Record<string, string> = { EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD', XAUUSD: 'Gold', WTI: 'Oil', BTCUSD: 'Bitcoin', SPY: 'S&P 500' };
const COUNTRY: Record<string, string> = { USD: 'US', EUR: 'Eurozone', GBP: 'UK', JPY: 'Japan', AUD: 'Australia', CAD: 'Canada', CHF: 'Switzerland', NZD: 'New Zealand', CNY: 'China' };
const MAX_IMAGE = 3_500_000; // base64 characters (about 2.6 MB image)


const SYSTEM = `You are MarkIQ SI Chart Review, a senior trading coach at a forex academy explaining a chart to a student.
You get the student's chart screenshot plus DATA computed by our engine from REAL price data and official economic data:
- DATA.bigPicture: the higher timeframe trend and structure (top-down view)
- DATA.zones: key support (S1, S2...) and resistance (R1, R2...) zones, each with the reasons that line up there and a score
- DATA.evidence and DATA.checklist: which way each piece of evidence leans
- DATA.plans: scenario plans A, B, C with trigger, invalidation, target and reward-to-risk already worked out
- DATA.fundamentals: upcoming events, latest results, central bank rates and the interest-rate gap
Write like a calm, sharp mentor:
- "story": 3-4 sentences, top-down: start with the bigger picture, then this timeframe, then where price sits between the zones and what the market is likely waiting for.
- "seen": what is drawn or visible on the screenshot (zones, lines, patterns, indicators), in plain words. Never read prices off the image.
- "drawings": if the student drew zones or lines, say whether they line up with our zones (by id, e.g. "your box near the top lines up with R1") or sit where no real level is. Empty list if nothing is drawn.
- "plans": for each plan id in DATA.plans, one or two sentences explaining WHY it makes sense or what would make it stronger or weaker (e.g. needs a retest, against the bigger trend, news risk). Do not change any numbers.
- "fundamentalStory": 2-3 sentences connecting the rates, the rate gap, recent results and upcoming events to this market. Only facts in DATA.fundamentals; if there is nothing, say so.
- "leaning": one sentence naming the plan the evidence favours and why, or say waiting is better when the evidence is mixed.
- "answer": a direct answer to the student's question, if they asked one (else "").
- "mistakes": 2-3 short mistakes traders commonly make in exactly this situation (e.g. buying into resistance, ignoring the bigger trend, trading right before news).
- "watch": 2-4 things to watch next.
Rules: every number you write MUST appear in DATA (sentences with other numbers are deleted). No "buy now"/"sell now", no lot sizes, no promises. Plain, simple English, short sentences.
If the screenshot clearly is not the market or timeframe chosen (very different price scale or a different symbol name), set "matches" false and explain in "mismatch".
Return JSON only: {"story": string, "seen": [string], "drawings": [string], "matches": boolean, "mismatch": string, "structure": [string], "fundamentals": [string], "fundamentalStory": string, "plans": [{"id": "A"|"B"|"C", "explain": string}], "leaning": string, "answer": string, "mistakes": [string], "watch": [string], "caution": string}`;

export async function POST(req: Request) {
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

  // 1. Real price data (needed for every answer), plus the higher timeframe and daily candles
  let structure: StructureSummary | null = null;
  let ltf: Candle[] = [];
  const digits = digitsFor(sym);
  try {
    const { candles } = await getHistory(sym, tf, null, 600);
    ltf = closedOnly(candles, tf);
    structure = analyzeStructure(ltf, digits);
  } catch (e) {
    await refundQuota(req, 'chart');
    const msg = safeError(e);
    console.error('chart analysis history', msg);
    return fail(/credit|limit|429/i.test(msg) ? 'Our price data limit is busy. Please wait a minute and try again.' : `We could not load ${sym.label} price history just now. Please try again in a minute.`, 502, msg);
  }
  if (!structure) {
    await refundQuota(req, 'chart');
    return fail('Not enough price history for this market and timeframe yet. Try a higher timeframe.');
  }

  const tfInfo = TIMEFRAMES.find((t) => t.key === tf)!;
  const htfKey = tfInfo.higher;
  const htfLabel = htfKey ? TIMEFRAMES.find((t) => t.key === htfKey)!.label : '';
  const optional = async (k: TF | null, n: number) => {
    if (!k) return null;
    try {
      return closedOnly((await getHistory(sym, k, null, n)).candles, k);
    } catch (e) {
      console.error('chart analysis optional history', k, safeError(e));
      return null;
    }
  };
  const [htf, daily] = await Promise.all([
    optional(htfKey, 400),
    tfInfo.minutes < 1440 && htfKey !== '1day' ? optional('1day', 60) : Promise.resolve(null),
  ]);
  const htfStructure = htf ? analyzeStructure(htf, digits) : null;

  // 2. News and rates (optional: an empty list if the market tables are not filled yet)
  const countries = sym.currencies.map((c) => COUNTRY[c]).filter(Boolean);
  let events: Record<string, unknown>[] = [], results: Record<string, unknown>[] = [], rates: Record<string, unknown>[] = [];
  try {
    const q = await db();
    [events, results, rates] = await Promise.all([
      q`SELECT country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE scheduled_at > now() AND scheduled_at < now() + interval '7 days' AND (currency = ANY(${sym.currencies}) OR country = ANY(${countries})) ORDER BY scheduled_at LIMIT 10`,
      q`SELECT country, name, actual, forecast, previous, verdict, source, released_at FROM mi_results WHERE country = ANY(${countries}) AND released_at > now() - interval '30 days' ORDER BY released_at DESC LIMIT 10`,
      q`SELECT bank, currency, rate, to_char(last_change_date, 'YYYY-MM-DD') AS last_change_date, to_char(next_meeting, 'YYYY-MM-DD') AS next_meeting FROM mi_rates WHERE currency = ANY(${sym.currencies})`,
    ]);
  } catch (e) {
    console.error('chart analysis news', safeError(e));
  }
  const asset = ASSETS.find((a) => a.key === ASSET_FOR[sym.key]);
  const tfLabel = TIMEFRAMES.find((t) => t.key === tf)?.label || tf;

  // 3. The market brain: zones, evidence and plans, all from real data
  const { zones, atr: a } = buildZones(sym, ltf, tfLabel, htf, htfLabel, htfKey === '1day' ? htf : daily, digits);
  const bigPicture = htfView(htfStructure, htfKey || '', htfLabel);
  const rateGap = rateGapOf(sym, rates);
  const newsSoon = newsWithin(events, 24);
  const checks = buildChecks({ ltf: structure, ltfLabel: tfLabel, htf: bigPicture, zones, atr: a, digits, rateGap, newsSoon });
  const evidence = evidenceOf(checks);
  const plans = buildPlans(zones, a, digits, structure.lastClose, evidence.lean);
  const brain: Brain = { htf: bigPicture, zones, checks, evidence, plans, atr: Number(a.toFixed(digits)), atrPips: Math.round(a / sym.pip), rateGap, newsSoon, chart: ltf.slice(-160) };

  const data = {
    market: sym.label, timeframe: tfLabel, lastClose: structure.lastClose, atr14: brain.atr, atrPips: brain.atrPips,
    bigPicture, thisTimeframe: { trend: structure.trend, structure: structure.structure, swings: structure.swings, rsi14: structure.rsi14, recentSetups: structure.recentSetups },
    zones: zones.map(({ id, side, price, low, high, score, reasons, distanceAtr }) => ({ id, side, price, low, high, score, reasons, distanceAtr })),
    evidence, checklist: checks, plans: plans.map(({ id, bias, kind, trigger, invalidation, target, rr }) => ({ id, bias, kind, trigger, invalidation, target, rewardToRisk: rr })),
    fundamentals: { upcoming_events: events, latest_results: results, central_bank_rates: rates, rate_gap: rateGap, high_impact_news_next_24h: newsSoon, background_drivers: asset?.drivers || [] },
  };

  // 4. AI reading of the screenshot and the coaching text. If it fails, still answer from the real data.
  let analysis: ChartAnalysis;
  let ai = true;
  let aiNote = '';
  try {
    const user = `The trader says this chart is ${sym.label} on the ${tfLabel} timeframe.${question ? ` Their question: ${question}` : ''}\n\nDATA: ${JSON.stringify(data)}`;
    const text = await gemini(SYSTEM, user, { json: true, maxTokens: 2200, images: [{ mime: m[1], data: m[2] }], timeoutMs: 45000 });
    const out = parseJson<Partial<ChartAnalysis> & { plans?: { id?: string; explain?: string }[] }>(text);
    if (!out || !out.story) throw new Error('The AI answer was incomplete');
    analysis = cleanAnalysis(out, allowedNumbers(data));
    if (!analysis.story) analysis.story = fromData(structure, brain, events, rates, tfLabel).story;
  } catch (e) {
    ai = false;
    aiNote = safeError(e);
    console.error('chart analysis ai', aiNote);
    analysis = fromData(structure, brain, events, rates, tfLabel);
  }
  return json({ ok: true, market: sym.label, timeframe: tfLabel, digits, structure, brain, analysis, ai, aiNote, remaining: quota.remaining });
}

