import type { CotRow } from '@/lib/terminal/cot';
import { crowd } from '@/lib/terminal/cot';

const n = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`;

function Spark({ h }: { h: { net: number }[] }) {
  if (h.length < 3) return null;
  const vals = h.map((x) => x.net), lo = Math.min(...vals, 0), hi = Math.max(...vals, 0);
  const W = 140, H = 36, y = (v: number) => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" />
      <polyline fill="none" stroke="#1A5FD0" strokeWidth={1.6} points={vals.map((v, i) => `${(i / (vals.length - 1)) * W},${y(v)}`).join(' ')} />
    </svg>
  );
}

export function CotView({ rows, error }: { rows: CotRow[]; error: string }) {
  const date = rows.map((r) => r.date).sort().pop();
  return (
    <section className="wrap stack" style={{ padding: '30px 16px 70px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">COT Report: what the big funds hold</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 880 }}>
          Every Friday the US regulator (CFTC) publishes how many futures contracts big speculators (funds) held on Tuesday. Net = long minus short. “Crowded” means the position is near its most extreme level of the last three years, which can mean a lot of the move has already happened.
        </p>
        {date && <span className="small faint">Latest report: positions on {new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
      </div>
      {error && <div className="empty">{error}</div>}
      {!error && rows.length === 0 && <div className="empty">The COT data is being downloaded from the CFTC. Please check back in a few minutes.</div>}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 820, fontSize: 16 }}>
            <thead><tr><th>Market</th><th>Funds net</th><th>Change this week</th><th>3-year range</th><th>Reading</th><th>Last 52 weeks</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ fontWeight: 700 }}>{r.label}</td>
                  <td className="mono" style={{ color: r.net >= 0 ? '#16a36a' : '#d4452f', fontWeight: 600 }}>{n(r.net)}</td>
                  <td className="mono" style={{ color: (r.change || 0) >= 0 ? '#16a36a' : '#d4452f' }}>{r.change == null ? '—' : n(r.change)}</td>
                  <td>
                    {r.pctile == null ? <span className="faint">—</span> : (
                      <span style={{ position: 'relative', display: 'block', width: 140, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, #d4452f, #E8E1D4 50%, #16a36a)' }} aria-label={`${r.pctile} of 100`}>
                        <span style={{ position: 'absolute', top: -4, left: `calc(${r.pctile}% - 3px)`, width: 6, height: 18, borderRadius: 3, background: 'var(--ink)' }} />
                      </span>
                    )}
                  </td>
                  <td><span className={`chip ${r.pctile != null && (r.pctile >= 90 || r.pctile <= 10) ? 'chip-high' : ''}`}>{crowd(r.pctile)}</span></td>
                  <td><Spark h={r.history} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small faint" style={{ margin: 0 }}>Source: U.S. Commodity Futures Trading Commission, Commitments of Traders (legacy, futures only), non-commercial positions. The US dollar index row is the ICE dollar index future. For learning, not financial advice.</p>
    </section>
  );
}
