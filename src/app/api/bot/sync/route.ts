import { db, hasDb } from '@/lib/db';
import { fail, json, safeError } from '@/lib/http';
import { botAuthorized } from '@/lib/botauth';
import { saveMarketData, type Obj } from '@/lib/mistore';

export const maxDuration = 60;

/*
 * The market bot sends its data here: POST /api/bot/sync with header Authorization: Bearer <CRON_SECRET>.
 * Body (every part optional): { events: [], results: [], news: [], rates: [], live: {} }.
 */
export async function POST(req: Request) {
  if (!botAuthorized(req)) return fail('Not allowed', 401);
  if (!hasDb()) return fail('Database not connected', 503);
  let b: Obj;
  try {
    b = (await req.json()) as Obj;
  } catch {
    return fail('Body must be JSON');
  }
  try {
    const q = await db();
    const { saved, skipped } = await saveMarketData(q, b);
    return json({ ok: true, saved, skipped });
  } catch (e) {
    console.error('bot sync', safeError(e));
    return json({ ok: false, error: 'Sync failed', detail: safeError(e) }, 500);
  }
}
