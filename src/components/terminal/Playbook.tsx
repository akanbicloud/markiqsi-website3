'use client';

import { useEffect, useState } from 'react';
import type { Playbook as PB } from '@/lib/terminal/playbook';

export const assetName = (a: string) => {
  const k = a.replace('/', '').toUpperCase();
  return k === 'XAUUSD' ? 'Gold' : k === 'SPY' ? 'S&P 500' : k === 'BTCUSD' ? 'Bitcoin' : k.length === 6 ? `${k.slice(0, 3)}/${k.slice(3)}` : a;
};

const TONE: Record<string, string> = { much_higher: '#E0592A', higher: '#FF9A6B', inline: '#7F93B8', lower: '#6FA0F0', much_lower: '#1A5FD0' };

export function Playbook({ id, actual }: { id: string; actual: string | null }) {
  const [p, setP] = useState<PB | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`/api/terminal/playbook?id=${encodeURIComponent(id)}`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!live) return; if (!r.ok || !d.ok) setErr(d.error || 'Could not load the playbook.'); else setP(d); })
      .catch(() => live && setErr('Could not load the playbook.'));
    return () => { live = false; };
  }, [id, actual]);
  if (err) return <p className="small" style={{ color: '#d4452f', margin: 0 }}>{err}</p>;
  if (!p) return <p className="small faint pulse" style={{ margin: 0 }}>Loading the playbook…</p>;
  if (!p.steps.length) return <p className="small muted" style={{ margin: 0 }}>No forecast has been published for this release yet, so there is no playbook. It appears once experts publish their forecast.</p>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row small muted" style={{ gap: '4px 14px' }}>
        <span>Expected <strong className="mono" style={{ color: 'var(--ink)' }}>{p.forecast}</strong></span>
        <span>A normal surprise is about <strong className="mono" style={{ color: 'var(--ink)' }}>{p.step}{p.unit}</strong></span>
        <span>{p.cases ? `Based on ${p.cases} past releases${p.since ? ` since ${p.since}` : ''}` : 'No past releases recorded for this one yet'}</span>
      </div>
      <div className="stack" style={{ gap: 6 }} role="list">
        {p.steps.map((s) => {
          const lit = p.lit === s.key;
          return (
            <div key={s.key} role="listitem" className="row" style={{ gap: '6px 14px', alignItems: 'center', padding: '10px 12px', borderRadius: 14, background: lit ? 'rgba(255,181,71,0.16)' : 'var(--inset)', border: `2px solid ${lit ? '#FFB547' : 'transparent'}` }}>
              <span style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, background: TONE[s.key] }} aria-hidden="true" />
              <span className="stack" style={{ flex: '0 0 220px', gap: 0 }}>
                <span style={{ fontWeight: 700 }}>{s.label}{lit && <span className="chip" style={{ marginLeft: 8, background: '#FFB547', color: '#0B1A36' }}>Result {p.actual}</span>}</span>
                <span className="mono small faint">{s.range}</span>
              </span>
              <span className="row" style={{ flex: '1 1 300px', gap: 8 }}>
                {s.markets.length === 0 && <span className="small faint">Not enough past cases yet</span>}
                {s.markets.map((m) => {
                  const up = m.up >= m.down;
                  return (
                    <span key={m.asset} className="small" style={{ padding: '4px 10px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line-soft)' }} title={`${m.cases} past cases, next ${m.horizon}`}>
                      <strong>{assetName(m.asset)}</strong>{' '}
                      <span style={{ color: up ? '#16a36a' : '#d4452f', fontWeight: 700 }}>{up ? '▲' : '▼'} {up ? m.up : m.down}/{m.cases}</span>{' '}
                      <span className="mono faint">avg {m.avg > 0 ? '+' : ''}{m.avg.toFixed(2)}% · {m.horizon}</span>
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      <span className="small faint">▲ 7/9 means the market rose in 7 of the 9 past releases that landed in that range. History shows what usually happened, never a promise.</span>
    </div>
  );
}
