import { db, hasDb } from './db';
import { clientIp } from './http';
import { sha256 } from './crypto';
import { getSession } from './session';

/**
 * Daily free-use limits for features that cost money (AI) or use limited price data.
 * Visitors do not need an account; signed-in users get a higher limit.
 * Limits can be changed with environment variables, e.g. LIMIT_ANON_CHART=2.
 */
const DEFAULTS: Record<string, { anon: number; user: number }> = {
  ai_build: { anon: 10, user: 40 }, // AI help understanding a bot or indicator description
  backtest: { anon: 15, user: 60 },
  chart: { anon: 2, user: 8 },
  replay: { anon: 6, user: 30 }, // a past release not replayed before (uses price data) // chart screenshot analysis (images cost the most)
};

function limitFor(feature: string, signedIn: boolean) {
  const d = DEFAULTS[feature] || { anon: 10, user: 40 };
  const raw = process.env[`LIMIT_${signedIn ? 'USER' : 'ANON'}_${feature.toUpperCase()}`];
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 0 ? n : signedIn ? d.user : d.anon;
}

function whoFor(req: Request, s: { uid: number } | null) {
  return s ? `u:${s.uid}` : `ip:${sha256(clientIp(req) + (process.env.AUTH_SECRET || '')).slice(0, 32)}`;
}

/** Gives a use back when the feature failed on our side, so people are not charged for errors. */
export async function refundQuota(req: Request, feature: string) {
  if (!hasDb()) return;
  try {
    const s = await getSession().catch(() => null);
    const q = await db();
    await q`UPDATE mq_usage SET count = GREATEST(0, count - 1) WHERE who = ${whoFor(req, s)} AND feature = ${feature} AND day = CURRENT_DATE`;
  } catch {
    // never let a refund error hide the real error
  }
}

export type UsageResult = { ok: boolean; remaining: number; limit: number; signedIn: boolean };

/** Counts one use and says whether it is allowed. Without a database it always allows (local dev). */
export async function takeQuota(req: Request, feature: string): Promise<UsageResult> {
  const s = await getSession().catch(() => null);
  const signedIn = !!s;
  const limit = limitFor(feature, signedIn);
  if (!hasDb()) return { ok: true, remaining: limit, limit, signedIn };
  const who = whoFor(req, s);
  const q = await db();
  const rows = (await q`INSERT INTO mq_usage (who, feature, day, count) VALUES (${who}, ${feature}, CURRENT_DATE, 1)
    ON CONFLICT (who, feature, day) DO UPDATE SET count = mq_usage.count + 1 RETURNING count`) as { count: number }[];
  const used = Number(rows[0].count);
  if (Math.random() < 0.01) await q`DELETE FROM mq_usage WHERE day < CURRENT_DATE - 7`;
  return { ok: used <= limit, remaining: Math.max(0, limit - used), limit, signedIn };
}

export function quotaMessage(r: UsageResult, what: string) {
  return r.signedIn
    ? `You have used today's ${r.limit} free ${what}. Please come back tomorrow.`
    : `You have used today's ${r.limit} free ${what}. Create a free account for more, or come back tomorrow.`;
}
