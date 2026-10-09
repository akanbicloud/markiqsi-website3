import { timingSafeEqual } from 'crypto';

/** True when the request carries the shared CRON_SECRET (used by the market bot). Compared in constant time. */
export function botAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
