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
          try {
            const feeds = (await sql()`SELECT key, COALESCE(last_success, fetched_at) AS fetched_at, ok, note FROM mq_feed_state ORDER BY key`) as { key: string; fetched_at: string; ok: boolean | null; note: string | null }[];
            const counts = (await sql()`SELECT (SELECT count(*) FROM mi_events WHERE scheduled_at > now()) AS events, (SELECT count(*) FROM mi_news) AS news, (SELECT count(*) FROM mi_rates) AS rates, (SELECT count(*) FROM mi_results) AS results`) as Record<string, string>[];
            out.marketFeeds = { rows: counts[0], feeds: feeds.map((f) => `${f.key}: ${f.ok === false ? 'FAILED' : f.ok ? 'OK' : 'pending'} at ${new Date(f.fetched_at).toISOString().slice(0, 16)} UTC${f.note ? ` (${clean(f.note)})` : ''}`) };
          } catch { /* table may not exist yet */ }
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

  // Email (Resend): is the sending domain verified?
  const rk = process.env.RESEND_API_KEY?.trim();
  if (!rk) out.email = 'NOT SET: add RESEND_API_KEY in Vercel';
  else {
    const from = process.env.EMAIL_FROM || '';
    const domain = (from.match(/@([^>\s]+)/) || [])[1]?.toLowerCase() || '';
    try {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${rk}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      if (!r.ok) out.email = r.status === 401 && /restrict/i.test(d.message || '') ? 'Key works for sending only, so domain status cannot be checked here. Check Resend > Domains.' : 'KEY REJECTED: ' + clean(d.message || String(r.status));
      else {
        const list = (d.data || []) as { name: string; status: string }[];
        const mine = list.find((x) => x.name.toLowerCase() === domain);
        out.email = !domain ? 'EMAIL_FROM has no @domain' : mine ? (mine.status === 'verified' ? `OK (${domain} verified)` : `DOMAIN NOT VERIFIED YET: ${domain} is "${mine.status}" in Resend`) : `DOMAIN MISSING: ${domain} is not added in Resend (added: ${list.map((x) => `${x.name} = ${x.status}`).join(', ') || 'none'})`;
      }
    } catch (e) {
      out.email = 'CANNOT REACH: ' + clean((e as Error).message);
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
