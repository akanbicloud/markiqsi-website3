import { hasDb } from '@/lib/db';
import { fail, json } from '@/lib/http';
import { getHistory } from '@/lib/trading/history';
import { TF_KEYS, findSymbol, type TF } from '@/lib/trading/symbols';

export const maxDuration = 60;

export async function GET(req: Request) {
  if (!hasDb()) return fail('Charts are not connected yet.', 503);
  if (!process.env.TWELVE_DATA_API_KEY) return fail('Chart history is being set up. Please check back soon.', 503);
  const u = new URL(req.url);
  const sym = findSymbol(u.searchParams.get('symbol') || '');
  const tf = u.searchParams.get('tf') as TF;
  if (!sym) return fail('Unknown market.');
  if (!TF_KEYS.includes(tf)) return fail('Unknown timeframe.');
  const before = Number(u.searchParams.get('before')) || null;
  const limit = Math.max(100, Math.min(5000, Number(u.searchParams.get('limit')) || 2000));
  try {
    const h = await getHistory(sym, tf, before, limit);
    return json({ ok: true, symbol: sym.label, pip: sym.pip, ...h });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('history', msg);
    return fail(/credit|limit/i.test(msg) ? 'Our price data limit is busy. Please try again in a minute.' : 'Could not load chart history. Please try again.', 502);
  }
}
