'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Trade = { id: number; trade_date: string; symbol: string; direction: string; lots: string | null; entry: string | null; exit: string | null; pnl: string; setup: string | null; notes: string | null };

const today = () => new Date().toISOString().slice(0, 10);

export function Journal({ signedIn }: { signedIn: boolean }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [form, setForm] = useState({ date: today(), symbol: 'EURUSD', direction: 'Buy', lots: '', entry: '', exit: '', pnl: '', setup: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/journal');
    const d = await r.json().catch(() => ({}));
    if (d.ok) setTrades(d.trades);
  }
  useEffect(() => { if (signedIn) load(); }, [signedIn]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const r = await fetch('/api/journal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.ok) return setErr(d.error || 'Could not save.');
    setForm({ ...form, lots: '', entry: '', exit: '', pnl: '', notes: '' });
    load();
  }
  async function remove(id: number) {
    if (!confirm('Delete this trade?')) return;
    await fetch(`/api/journal?id=${id}`, { method: 'DELETE' });
    load();
  }

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) m.set(t.trade_date, (m.get(t.trade_date) || 0) + Number(t.pnl));
    return m;
  }, [trades]);
  const monthTrades = trades.filter((t) => t.trade_date.startsWith(month));
  const total = monthTrades.reduce((s, t) => s + Number(t.pnl), 0);
  const wins = monthTrades.filter((t) => Number(t.pnl) > 0).length;
  const [y, mo] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };
  const money = (n: number) => (n < 0 ? '-$' : n > 0 ? '+$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const setups = Array.from(new Set(monthTrades.map((t) => t.setup).filter(Boolean))) as string[];

  if (!signedIn) {
    return (
      <div className="card-lg stack" style={{ gap: 16 }}>
        <h2 className="h2">Trading Journal</h2>
        <p style={{ margin: 0, fontSize: 18, color: 'var(--text)', maxWidth: 760 }}>Log every trade and see your results on a calendar. Learn which setups work for you, and which habits cost you money. Your journal is private to your account.</p>
        <Link href="/get-started" className="btn" style={{ alignSelf: 'flex-start' }}>Start my journal <span className="arr" aria-hidden="true">»</span></Link>
      </div>
    );
  }

  const fld = (k: keyof typeof form, label: string, type = 'text', extra: Record<string, string> = {}) => (
    <div className="field">
      <label htmlFor={`j-${k}`}>{label}</label>
      <input id={`j-${k}`} className="input" type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <div className="card-lg stack" style={{ gap: 26 }}>
      <h2 className="h2">Trading Journal</h2>
      <div className="row" style={{ gap: 30, alignItems: 'flex-start' }}>
        <form onSubmit={add} className="stack" style={{ flex: '1 1 380px', minWidth: 0, gap: 14 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>Log a trade</span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {fld('date', 'Date', 'date')}
            {fld('symbol', 'Market')}
            <div className="field">
              <label htmlFor="j-dir">Direction</label>
              <select id="j-dir" className="input select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option>Buy</option><option>Sell</option></select>
            </div>
            {fld('lots', 'Lots', 'number', { step: 'any' })}
            {fld('entry', 'Entry price', 'number', { step: 'any' })}
            {fld('exit', 'Exit price', 'number', { step: 'any' })}
            {fld('pnl', 'Profit / loss ($)', 'number', { step: 'any', placeholder: 'e.g. -25' })}
            {fld('setup', 'Setup', 'text', { placeholder: 'e.g. Order block' })}
          </div>
          <div className="field">
            <label htmlFor="j-notes">Notes</label>
            <textarea id="j-notes" className="textarea" style={{ minHeight: 80 }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why did you take it? How did you feel?" />
          </div>
          {err && <div role="alert" className="note note-bad">{err}</div>}
          <button type="submit" className="btn btn-sm" disabled={busy} style={{ alignSelf: 'flex-start' }}>Save trade</button>
        </form>
        <div className="stack" style={{ flex: '1 1 520px', minWidth: 0, gap: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <button type="button" className="toggle" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)}</span>
            <button type="button" className="toggle" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, fontSize: 12, textAlign: 'center' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="faint">{d}</span>)}
            {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysIn }).map((_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, '0')}`;
              const v = byDay.get(key);
              const bg = v == null ? 'var(--inset)' : v > 0 ? '#D4F7E7' : v < 0 ? '#FFE1D5' : 'var(--chip)';
              const col = v == null ? 'var(--faint)' : v > 0 ? '#0B5A38' : v < 0 ? '#9A2E0B' : 'var(--text)';
              return (
                <div key={key} style={{ minHeight: 56, borderRadius: 10, padding: '6px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: bg, color: col, textAlign: 'left' }}>
                  <span>{i + 1}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 11 }}>{v == null ? '' : money(Math.round(v))}</span>
                </div>
              );
            })}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div className="inset"><div className="small faint">Month P&amp;L</div><div className="mono" style={{ fontSize: 20, fontWeight: 600, color: total >= 0 ? '#0B8A55' : '#C2410C' }}>{money(Math.round(total * 100) / 100)}</div></div>
            <div className="inset"><div className="small faint">Trades</div><div className="mono" style={{ fontSize: 20 }}>{monthTrades.length}</div></div>
            <div className="inset"><div className="small faint">Win rate</div><div className="mono" style={{ fontSize: 20 }}>{monthTrades.length ? Math.round((wins / monthTrades.length) * 100) : 0}%</div></div>
          </div>
          {setups.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="label">By setup this month</span>
              {setups.map((s) => {
                const ts = monthTrades.filter((t) => t.setup === s);
                const p = ts.reduce((a, t) => a + Number(t.pnl), 0);
                return <span key={s} className="small">{s}: {ts.length} trades, {money(Math.round(p))}</span>;
              })}
            </div>
          )}
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>Trades this month</span>
        {monthTrades.length === 0 ? <div className="empty">No trades logged this month yet.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 680 }}>
              <thead><tr><th>Date</th><th>Market</th><th>Side</th><th>Lots</th><th>P&amp;L</th><th>Setup</th><th>Notes</th><th /></tr></thead>
              <tbody>
                {monthTrades.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.trade_date}</td><td>{t.symbol}</td><td>{t.direction}</td><td className="mono">{t.lots ?? ''}</td>
                    <td className="mono" style={{ color: Number(t.pnl) >= 0 ? '#0B8A55' : '#C2410C', fontWeight: 600 }}>{money(Number(t.pnl))}</td>
                    <td>{t.setup}</td><td style={{ maxWidth: 260 }}>{t.notes}</td>
                    <td><button type="button" className="linkbtn" onClick={() => remove(t.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
