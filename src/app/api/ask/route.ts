import { safeError } from '@/lib/http';
import { db, hasDb } from '@/lib/db';
import { body, clientIp, fail, json, str } from '@/lib/http';
import { sha256 } from '@/lib/crypto';
import { getSession } from '@/lib/session';
import { ASSETS, findAsset } from '@/lib/assets';
import { gemini, parseJson } from '@/lib/gemini';

const ANON_LIMIT = 3;
const USER_LIMIT = 20;

type Answer = { simply: string; drivers: { t: string; x: string }[]; latest: string[]; history: string[]; watch: string[]; missing?: string };

export async function POST(req: Request) {
  if (!hasDb()) return fail('Ask MarkIQ is not connected yet.', 503);
  if (!process.env.GEMINI_API_KEY) return fail('Ask MarkIQ is being set up. Please check back soon.', 503);
  const b = await body(req);
  const asset = findAsset(str(b.asset, 40)) || ASSETS[0];
  const question = str(b.question, 400) || `What is moving ${asset.label} right now?`;

  const s = await getSession();
  const who = s ? `u:${s.uid}` : `ip:${sha256(clientIp(req) + (process.env.AUTH_SECRET || '')).slice(0, 32)}`;
  const limit = s ? USER_LIMIT : ANON_LIMIT;
  const q = await db();
  const used = (await q`INSERT INTO mq_ask_usage (who, day, count) VALUES (${who}, CURRENT_DATE, 1)
    ON CONFLICT (who, day) DO UPDATE SET count = mq_ask_usage.count + 1 RETURNING count`) as { count: number }[];
  if (used[0].count > limit) {
    return fail(s ? `You have used your ${USER_LIMIT} questions for today. Come back tomorrow.` : `You have used your ${ANON_LIMIT} free questions for today. Create a free account to ask more.`, 429);
  }

  const [events, results, rates, reactions] = await Promise.all([
    q`SELECT country, currency, name, impact, scheduled_at, forecast, previous FROM mi_events WHERE scheduled_at > now() AND scheduled_at < now() + interval '8 days' AND (currency = ANY(${asset.currencies}) OR country = ANY(${asset.countries})) ORDER BY scheduled_at LIMIT 12`,
    q`SELECT country, name, actual, forecast, previous, verdict, source, released_at FROM mi_results WHERE country = ANY(${asset.countries}) AND released_at > now() - interval '45 days' ORDER BY released_at DESC LIMIT 12`,
    q`SELECT bank, currency, rate, last_change, to_char(last_change_date, 'YYYY-MM-DD') AS last_change_date, to_char(next_meeting, 'YYYY-MM-DD') AS next_meeting, updated_at FROM mi_rates WHERE currency = ANY(${asset.currencies})`,
    q`SELECT event_name, released_at, surprise, asset, move_1h, move_1d, note FROM mi_reactions WHERE asset ILIKE ${'%' + asset.key.replace('/', '') + '%'} OR asset ILIKE ${'%' + asset.key + '%'} ORDER BY released_at DESC LIMIT 15`,
  ]);

  const data = { asset: asset.label, upcoming_events: events, latest_official_results: results, central_bank_rates: rates, past_reactions: reactions };
  const system = `You are Ask MarkIQ, the market explainer for MarkIQ SI, a trading education platform.
Rules you must follow:
- Explain in plain, simple English for beginners. Short sentences.
- Use ONLY the numbers, dates and facts inside DATA. Never invent or estimate a number, date, rate or event. If something the user asks about is not in DATA, say clearly that it is not in our data yet.
- Never tell the user to buy or sell, never predict a price, never promise results. Past reactions are history, not a promise.
- Background drivers are general knowledge you may explain without numbers.
Return JSON only with this shape: {"simply": string (one sentence), "drivers": [{"t": string, "x": string}] (3-4 items), "latest": [string] (facts from latest_official_results and central_bank_rates, each with its date and source; empty if none), "history": [string] (from past_reactions only; empty if none), "watch": [string] (from upcoming_events only, with day and time in UTC; empty if none), "missing": string (what we do not have data for, or empty)}.`;
  const user = `QUESTION: ${question}\n\nBACKGROUND DRIVERS (general knowledge): ${JSON.stringify(asset.drivers)}\n\nDATA: ${JSON.stringify(data)}`;
  try {
    const text = await gemini(system, user, { json: true });
    const a = parseJson<Answer>(text);
    if (!a || !a.simply) throw new Error('bad answer');
    return json({
      ok: true,
      asset: asset.label,
      answer: {
        simply: String(a.simply).slice(0, 400),
        drivers: (a.drivers || []).slice(0, 5).map((d) => ({ t: String(d.t).slice(0, 80), x: String(d.x).slice(0, 300) })),
        latest: (a.latest || []).slice(0, 6).map((x) => String(x).slice(0, 300)),
        history: (a.history || []).slice(0, 5).map((x) => String(x).slice(0, 300)),
        watch: (a.watch || []).slice(0, 6).map((x) => String(x).slice(0, 300)),
        missing: a.missing ? String(a.missing).slice(0, 300) : '',
      },
      sources: Array.from(new Set([...asset.sources, ...(results as { source: string }[]).map((r) => r.source)])),
      remaining: Math.max(0, limit - used[0].count),
    });
  } catch (e) {
    console.error('ask failed', safeError(e));
    return fail('Ask MarkIQ could not answer just now. Please try again in a minute.', 502);
  }
}
