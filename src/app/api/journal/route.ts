import { db } from '@/lib/db';
import { body, fail, json, str } from '@/lib/http';
import { getSession } from '@/lib/session';

export async function GET() {
  const s = await getSession();
  if (!s) return json({ ok: true, signedIn: false, trades: [] });
  const q = await db();
  const trades = await q`SELECT id, to_char(trade_date, 'YYYY-MM-DD') AS trade_date, symbol, direction, lots, entry, exit, pnl, setup, notes FROM mq_journal WHERE user_id = ${s.uid} ORDER BY trade_date DESC, id DESC LIMIT 2000`;
  return json({ ok: true, signedIn: true, trades });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in to save trades.', 401);
  const b = await body(req);
  const date = str(b.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Please pick a date.');
  const symbol = str(b.symbol, 20).toUpperCase();
  if (!symbol) return fail('Please enter the market, for example EURUSD.');
  const direction = b.direction === 'Sell' ? 'Sell' : 'Buy';
  const n = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const pnl = n(b.pnl);
  if (pnl == null) return fail('Please enter the profit or loss (use a minus sign for a loss).');
  const q = await db();
  const rows = await q`INSERT INTO mq_journal (user_id, trade_date, symbol, direction, lots, entry, exit, pnl, setup, notes)
    VALUES (${s.uid}, ${date}, ${symbol}, ${direction}, ${n(b.lots)}, ${n(b.entry)}, ${n(b.exit)}, ${pnl}, ${str(b.setup, 80) || null}, ${str(b.notes, 2000) || null}) RETURNING id`;
  return json({ ok: true, id: (rows as { id: number }[])[0].id });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return fail('Please log in.', 401);
  const id = Number(new URL(req.url).searchParams.get('id'));
  const q = await db();
  await q`DELETE FROM mq_journal WHERE id = ${id} AND user_id = ${s.uid}`;
  return json({ ok: true });
}
