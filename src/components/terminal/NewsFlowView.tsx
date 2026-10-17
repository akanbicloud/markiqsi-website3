'use client';

import { useMemo, useState } from 'react';
import type { FlowItem, ToneDay } from '@/lib/terminal/newsflow';
import { THEME_ICON } from '@/lib/terminal/themes';

const FILTERS: [string, string][] = [['all', 'All'], ['fed', 'Central banks'], ['war', 'War & geopolitics'], ['trump', 'Trump'], ['trade', 'Trade'], ['energy', 'Energy'], ['election', 'Elections'], ['data', 'Economy']];
const MKT: Record<string, string> = { GOLD: 'Gold', OIL: 'Oil', STOCKS: 'Stocks', BTC: 'Bitcoin' };

function toneColor(v: number | null, kind: 'fed' | 'war') {
  if (v == null) return 'var(--line-soft)';
  const a = Math.min(1, Math.abs(v) / 2) * 0.85 + 0.15;
  if (kind === 'fed') return v >= 0 ? `rgba(224,89,42,${a})` : `rgba(26,95,208,${a})`;
  return v >= 0 ? `rgba(212,69,47,${a})` : `rgba(22,163,106,${a})`;
}

function toneWord(v: number | null, kind: 'fed' | 'war') {
  if (v == null) return 'No news';
  const a = Math.abs(v);
  const s = a < 0.3 ? 'Neutral' : a < 1 ? 'Leaning' : 'Clearly';
  if (s === 'Neutral') return 'Neutral';
  if (kind === 'fed') return `${s} ${v > 0 ? 'hawkish' : 'dovish'}`;
  return `${s} ${v > 0 ? 'escalating' : 'calming'}`;
}

function Strip({ days, kind, title, help }: { days: ToneDay[]; kind: 'fed' | 'war'; title: string; help: string }) {
  const last7 = days.slice(-7).map((d) => (kind === 'fed' ? d.fed : d.war)).filter((v): v is number => v != null);
  const week = last7.length ? last7.reduce((a, b) => a + b, 0) / last7.length : null;
  return (
    <div className="card stack" style={{ borderRadius: 22, padding: 20, gap: 10, flex: '1 1 420px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 21, margin: 0 }}>{title}</h2>
        <span style={{ fontWeight: 700, color: toneColor(week, kind) === 'var(--line-soft)' ? 'var(--muted)' : toneColor(week == null ? null : Math.sign(week) * 2, kind) }}>This week: {toneWord(week, kind)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 2 }} role="img" aria-label={`${title}, last ${days.length} days`}>
        {days.map((d) => {
          const v = kind === 'fed' ? d.fed : d.war, n = kind === 'fed' ? d.fedN : d.warN;
          return <span key={d.day} title={`${d.day}: ${toneWord(v, kind)}${n ? ` (${n} stories)` : ''}`} style={{ height: 30, borderRadius: 4, background: toneColor(v, kind) }} />;
        })}
      </div>
      <div className="row small faint" style={{ justifyContent: 'space-between' }}><span>30 days ago</span><span>{help}</span><span>Today</span></div>
    </div>
  );
}

export function NewsFlowView({ items, tone, error }: { items: FlowItem[]; tone: ToneDay[]; error: string }) {
  const [f, setF] = useState('all');
  const [story, setStory] = useState('');
  const [shown, setShown] = useState(18);
  const weekAgo = Date.now() - 7 * 86400000;
  const stories = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (new Date(i.published_at).getTime() > weekAgo) m.set(i.story, (m.get(i.story) || 0) + i.impact);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [items, weekAgo]);
  const trump = items.filter((i) => i.trump).slice(0, 6);
  const list = items.filter((i) => (f === 'all' || (f === 'trump' ? i.trump : i.theme === f)) && (!story || i.story === story));

  return (
    <section className="wrap stack" style={{ padding: '30px 16px 70px', gap: 18 }}>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="h2">News Flow</h1>
        <p className="muted" style={{ margin: 0, fontSize: 17, maxWidth: 880 }}>Every headline sorted into the story it belongs to, with the chain from the news to the markets. The strips show whether central banks sound tougher or softer, and whether wars and tensions are heating up or calming down.</p>
      </div>
      {error && <div className="empty">{error}</div>}
      {!error && items.length === 0 && <div className="empty">Headlines are being sorted. Tagged stories appear here within a few minutes.</div>}
      {items.length > 0 && (
        <>
          <div className="row" style={{ gap: 14 }}>
            <Strip days={tone} kind="fed" title="🏦 Central bank tone" help="Blue = softer (cuts) · Orange = tougher (hikes)" />
            <Strip days={tone} kind="war" title="⚔️ War & tension tone" help="Green = calming · Red = escalating" />
          </div>

          <div className="row" style={{ gap: 14, alignItems: 'stretch' }}>
            <div className="card stack" style={{ flex: '1 1 380px', borderRadius: 22, padding: 20, gap: 10 }}>
              <h2 className="display" style={{ fontWeight: 700, fontSize: 21, margin: 0 }}>Biggest stories this week</h2>
              <div className="row" style={{ gap: 8 }}>
                {stories.map(([s, n]) => (
                  <button key={s} type="button" className="toggle" aria-pressed={story === s} onClick={() => setStory(story === s ? '' : s)}>{s} <span className="faint">· {n}</span></button>
                ))}
                {stories.length === 0 && <span className="small faint">No tagged stories this week yet.</span>}
              </div>
            </div>
            <div className="stack" style={{ flex: '1 1 380px', borderRadius: 22, padding: 20, gap: 10, background: '#0B1A36', color: '#fff' }}>
              <h2 className="display" style={{ fontWeight: 700, fontSize: 21, margin: 0 }}>🇺🇸 Trump tracker</h2>
              {trump.length === 0 && <span className="small" style={{ color: '#B9C9E6' }}>No market-moving Trump headlines in the last 30 days.</span>}
              {trump.map((i) => (
                <div key={i.id} className="stack" style={{ gap: 2, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span className="small mono" style={{ color: '#9FB2D6' }}>{new Date(i.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ fontWeight: 600 }}>{i.title}</span>
                  {i.chain && <span className="small" style={{ color: '#FFB547' }}>{i.chain}</span>}
                </div>
              ))}
            </div>
          </div>

          <div role="group" aria-label="Theme" className="row" style={{ gap: 6 }}>
            {FILTERS.map(([k, l]) => <button key={k} type="button" className="toggle" aria-pressed={f === k} onClick={() => setF(k)}>{k !== 'all' && <span aria-hidden="true">{THEME_ICON[k]} </span>}{l}</button>)}
            {story && <button type="button" className="toggle" aria-pressed onClick={() => setStory('')}>Story: {story} ✕</button>}
          </div>
          <div className="grid g-3" style={{ gap: 14 }}>
            {list.slice(0, shown).map((i) => (
              <article key={i.id} className="card stack" style={{ borderRadius: 22, padding: 20, gap: 8 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="chip">{THEME_ICON[i.trump ? 'trump' : i.theme] || '📰'} {i.story}</span>
                  <span aria-label={`Impact ${i.impact} of 3`} title={`Impact ${i.impact} of 3`} style={{ display: 'inline-flex', gap: 3 }}>
                    {[1, 2, 3].map((n) => <span key={n} style={{ width: 8, height: 8, borderRadius: '50%', background: n <= i.impact ? '#E0592A' : 'var(--line-soft)' }} />)}
                  </span>
                </div>
                <h3 className="display" style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.25, margin: 0 }}>{i.title}</h3>
                {i.chain && <span className="small" style={{ fontWeight: 600, color: 'var(--blue)' }}>{i.chain}</span>}
                {i.markets.length > 0 && (
                  <div className="row" style={{ gap: 6 }}>
                    {i.markets.map((m) => <span key={m.market} className="small" style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--inset)', fontWeight: 600, color: m.dir === 'up' ? '#16a36a' : '#d4452f' }}>{MKT[m.market] || m.market} {m.dir === 'up' ? '▲' : '▼'}</span>)}
                  </div>
                )}
                <span className="small faint" style={{ marginTop: 'auto' }}>
                  {new Date(i.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {i.speaker ? ` · ${i.speaker}` : ''}{i.source ? ' · ' : ''}{i.source && (i.source_url ? <a href={i.source_url} target="_blank" rel="noopener noreferrer">{i.source}</a> : i.source)}
                </span>
              </article>
            ))}
          </div>
          {list.length > shown && <button type="button" className="btn btn-outline" style={{ alignSelf: 'center' }} onClick={() => setShown(shown + 18)}>Show more stories</button>}
          <p className="small faint" style={{ margin: 0 }}>Stories, tone and market arrows are sorted by AI from each headline and show the usual direction, not a forecast. Headlines link to their source.</p>
        </>
      )}
    </section>
  );
}
