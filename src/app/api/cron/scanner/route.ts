import { timingSafeEqual } from 'crypto';
import { hasDb } from '@/lib/db';
import { fail, json } from '@/lib/http';
import { refreshPrices } from '@/lib/trading/prices';
import { scanAll, sendEventReminders, sendScanAlerts } from '@/lib/trading/scanner';

export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const u = new URL(req.url);
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || u.searchParams.get('key') || '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The market bot calls this every 2 minutes: GET /api/cron/scanner with header "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!authorized(req)) return fail('Not allowed', 401);
  if (!hasDb()) return fail('Database not connected', 503);
  const out: Record<string, unknown> = {};
  try {
    out.prices = process.env.TWELVE_DATA_API_KEY ? await refreshPrices(7) : 'TWELVE_DATA_API_KEY not set';
    out.scan = await scanAll();
    out.alerts = await sendScanAlerts();
    out.reminders = await sendEventReminders();
    return json({ ok: true, ...out });
  } catch (e) {
    console.error('cron', e);
    return json({ ok: false, error: (e as Error).message, ...out }, 500);
  }
}
