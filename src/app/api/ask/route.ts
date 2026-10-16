import { safeError } from '@/lib/http';
import { db, hasDb } from '@/lib/db';
import { body, clientIp, fail, json, str } from '@/lib/http';
import { sha256 } from '@/lib/crypto';
import { getSession } from '@/lib/session';
import { findAsset } from '@/lib/assets';
import { answerQuestion, type Turn } from '@/lib/askbrain';

export const maxDuration = 60;

const ANON_LIMIT = 3;
const USER_LIMIT = 20;

export async function POST(req: Request) {
  if (!hasDb()) return fail('Ask MarkIQ is not connected yet.', 503);
  if (!process.env.GEMINI_API_KEY) return fail('Ask MarkIQ is being set up. Please check back soon.', 503);
  const b = await body(req);
  const focus = findAsset(str(b.asset, 40)) || null;
  const question = str(b.question, 400) || (focus ? `What is moving ${focus.label} right now?` : '');
  if (question.length < 2) return fail('Type a question first.');

  const s = await getSession();
  const who = s ? `u:${s.uid}` : `ip:${sha256(clientIp(req) + (process.env.AUTH_SECRET || '')).slice(0, 32)}`;
  const limit = s ? USER_LIMIT : ANON_LIMIT;
  const q = await db();
  const used = (await q`INSERT INTO mq_ask_usage (who, day, count) VALUES (${who}, CURRENT_DATE, 1)
    ON CONFLICT (who, day) DO UPDATE SET count = mq_ask_usage.count + 1 RETURNING count`) as { count: number }[];
  if (used[0].count > limit) {
    return fail(s ? `You have used your ${USER_LIMIT} questions for today. Come back tomorrow.` : `You have used your ${ANON_LIMIT} free questions for today. Create a free account to ask more.`, 429);
  }

  const history = (Array.isArray(b.history) ? b.history : []).slice(-3).map((t: { q?: unknown; a?: unknown }) => ({ q: str(t?.q, 400), a: str(t?.a, 700) })).filter((t: Turn) => t.q);
  try {
    const answer = await answerQuestion({ question, focus: focus?.key || null, history });
    return json({ ok: true, asset: answer.assets.join(', '), answer, sources: answer.sources, remaining: Math.max(0, limit - used[0].count) });
  } catch (e) {
    console.error('ask failed', safeError(e));
    await q`UPDATE mq_ask_usage SET count = greatest(count - 1, 0) WHERE who = ${who} AND day = CURRENT_DATE`.catch(() => null);
    return fail('Ask MarkIQ could not answer just now (your question was not counted). Please try again in a minute.', 502, safeError(e));
  }
}
