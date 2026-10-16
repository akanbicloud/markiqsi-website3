import { hasDb } from '@/lib/db';
import { body, fail, json, safeError, str } from '@/lib/http';
import { botAuthorized } from '@/lib/botauth';
import { findAsset } from '@/lib/assets';
import { answerQuestion, type Turn } from '@/lib/askbrain';

export const maxDuration = 60;

/**
 * The Telegram bot sends user questions here so Telegram and the website give the same answers.
 * POST { question, focus?, history?: [{q, a}] } with header Authorization: Bearer <CRON_SECRET>.
 * The bot applies its own per-user limits.
 */
export async function POST(req: Request) {
  if (!botAuthorized(req)) return fail('Not allowed', 401);
  if (!hasDb() || !process.env.GEMINI_API_KEY) return fail('Ask MarkIQ is not connected yet.', 503);
  const b = await body(req);
  const question = str(b.question, 600);
  if (question.length < 2) return fail('Empty question');
  const focus = findAsset(str(b.focus, 40));
  const history = (Array.isArray(b.history) ? b.history : []).slice(-3).map((t: { q?: unknown; a?: unknown }) => ({ q: str(t?.q, 400), a: str(t?.a, 700) })).filter((t: Turn) => t.q);
  try {
    return json({ ok: true, answer: await answerQuestion({ question, focus: focus?.key || null, history }) });
  } catch (e) {
    console.error('bot ask', safeError(e));
    return fail('Could not answer right now', 502, safeError(e));
  }
}
