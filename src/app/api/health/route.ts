import { ensureSchema, hasDb, schemaWarnings, sql } from '@/lib/db';
import { json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Never show secrets: hide connection strings, keys and long tokens in error messages. */
function clean(msg: string) {
  return msg
    .replace(/postgres(ql)?:\/\/\S+/gi, 'postgres://***')
    .replace(/apikey=\S+/gi, 'apikey=***')
    .replace(/[A-Za-z0-9_-]{28,}/g, '***')
    .slice(0, 300);
}

/** A quick check of every connection. Open /api/health in the browser after a deploy. */
export async function GET() {
  const env = (k: string) => !!process.env[k]?.trim();
  const out: Record<string, unknown> = {
    env: {
      DATABASE_URL: env('DATABASE_URL'),
      AUTH_SECRET: env('AUTH_SECRET'),
      SITE_URL: process.env.SITE_URL || '(not set)',
      RESEND_API_KEY: env('RESEND_API_KEY'),
      EMAIL_FROM: process.env.EMAIL_FROM || '(not set)',
      GEMINI_API_KEY: env('GEMINI_API_KEY'),
      TWELVE_DATA_API_KEY: env('TWELVE_DATA_API_KEY'),
      TELEGRAM_BOT_TOKEN: env('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || '(not set)',
      CRON_SECRET: env('CRON_SECRET'),
    },
  };

  // Database
  if (!hasDb()) out.database = 'NOT SET: add DATABASE_URL in Vercel';
  else {
    const url = process.env.DATABASE_URL!.trim().replace(/^psql\s+/, '').replace(/^['"]|['"]$/g, '');
    if (!/^postgres(ql)?:\/\//.test(url)) out.database = 'WRONG FORMAT: DATABASE_URL must start with postgresql:// (copy only the connection string, without psql or quotes)';
    else {
      try {
        await sql()`SELECT 1 AS ok`;
        try {
          await ensureSchema();
          out.database = schemaWarnings.length ? 'OK (with warnings)' : 'OK';
          if (schemaWarnings.length) out.databaseWarnings = schemaWarnings.map(clean);
        } catch (e) {
          out.database = 'CONNECTED, but creating tables failed: ' + clean((e as Error).message);
        }
      } catch (e) {
        out.database = 'CANNOT CONNECT: ' + clean((e as Error).message);
      }
    }
  }

  // Price data (this check does not use any price credits)
  const td = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!td) out.priceData = 'NOT SET: add TWELVE_DATA_API_KEY in Vercel';
  else {
    try {
      const r = await fetch(`https://api.twelvedata.com/api_usage?apikey=${encodeURIComponent(td)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      out.priceData = d.status === 'error' ? 'KEY REJECTED: ' + clean(d.message || '') : `OK (${d.current_usage ?? '?'} of ${d.plan_limit ?? '?'} credits used this minute, plan: ${d.plan_category ?? '?'})`;
    } catch (e) {
      out.priceData = 'CANNOT REACH: ' + clean((e as Error).message);
    }
  }

  // Telegram
  const tg = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!tg) out.telegram = 'NOT SET';
  else {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tg}/getMe`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      out.telegram = d.ok ? `OK (@${d.result.username})` : 'TOKEN REJECTED: get a new token from BotFather';
    } catch (e) {
      out.telegram = 'CANNOT REACH: ' + clean((e as Error).message);
    }
  }

  return json(out);
}
