'use client';

import { useState } from 'react';

type Code = { code: string; kind: string; deal: string; courses: string; used: number; max: number | null; expires: string; active: boolean; owner: string; note: string };

export function AdminCodes({ codes, courses }: { codes: Code[]; courses: { slug: string; title: string }[] }) {
  const [list, setList] = useState(codes);
  const [f, setF] = useState({ code: '', type: 'percent', percent: '10', amount_ngn: '', amount_usd: '', max_uses: '', expires_on: '', note: '', courses: [] as string[] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create() {
    setMsg(null);
    const r = await fetch('/api/admin/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      code: f.code, percent: f.type === 'percent' ? f.percent : '', amount_ngn: f.type === 'amount' ? f.amount_ngn : '', amount_usd: f.type === 'amount' ? f.amount_usd : '',
      max_uses: f.max_uses, expires_on: f.expires_on, note: f.note, courses: f.courses }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) return setMsg({ ok: false, text: d.error || 'Could not create the code.' });
    setMsg({ ok: true, text: `Code ${d.code} is ready. Refresh the page to see it in the list.` });
    setF({ ...f, code: '', note: '' });
  }

  async function toggle(code: string) {
    const r = await fetch('/api/admin/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, action: 'toggle' }) });
    if (r.ok) setList((l) => l.map((x) => (x.code === code ? { ...x, active: !x.active } : x)));
  }

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card stack" style={{ gap: 12 }}>
        <h2 className="h3" style={{ margin: 0 }}>New discount code</h2>
        <div className="grid g-2" style={{ gap: 12 }}>
          <label className="field">Code (letters and numbers)<input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="LAUNCH10" maxLength={24} /></label>
          <label className="field">Type<select className="input select" value={f.type} onChange={set('type')}><option value="percent">Percent off</option><option value="amount">Amount off</option></select></label>
          {f.type === 'percent' ? (
            <label className="field">Percent off<input className="input" type="number" min={1} max={90} value={f.percent} onChange={set('percent')} /></label>
          ) : (
            <>
              <label className="field">Naira off<input className="input" type="number" min={0} value={f.amount_ngn} onChange={set('amount_ngn')} placeholder="5000" /></label>
              <label className="field">Dollars off (online only)<input className="input" type="number" min={0} value={f.amount_usd} onChange={set('amount_usd')} placeholder="5" /></label>
            </>
          )}
          <label className="field">Maximum uses (empty = no limit)<input className="input" type="number" min={1} value={f.max_uses} onChange={set('max_uses')} /></label>
          <label className="field">Last day (empty = no end)<input className="input" type="date" value={f.expires_on} onChange={set('expires_on')} /></label>
          <label className="field">Note (only you see this)<input className="input" value={f.note} onChange={set('note')} placeholder="Launch week promo" maxLength={120} /></label>
        </div>
        <fieldset className="stack" style={{ gap: 6, border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Courses (none ticked = all courses)</legend>
          {courses.map((c) => (
            <label key={c.slug} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={f.courses.includes(c.slug)} onChange={(e) => setF({ ...f, courses: e.target.checked ? [...f.courses, c.slug] : f.courses.filter((x) => x !== c.slug) })} /> {c.title}
            </label>
          ))}
        </fieldset>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={create}>Create code</button>
        {msg && <div className={`note ${msg.ok ? 'note-ok' : 'note-bad'}`}>{msg.text}</div>}
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <h2 className="h3" style={{ margin: 0 }}>All codes</h2>
        {list.length === 0 && <p className="muted">No codes yet.</p>}
        {list.map((c) => (
          <div key={c.code} className="card row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center', opacity: c.active ? 1 : 0.55 }}>
            <div className="stack" style={{ gap: 4 }}>
              <strong>{c.code} <span className="chip">{c.kind === 'referral' ? 'referral' : 'discount'}</span></strong>
              <span className="muted" style={{ fontSize: 15 }}>{c.deal} · {c.courses} · used {c.used}{c.max != null ? ` of ${c.max}` : ''}{c.expires ? ` · ends ${c.expires}` : ''}</span>
              {(c.owner || c.note) && <span className="faint" style={{ fontSize: 13 }}>{c.owner ? `Owner: ${c.owner}` : ''}{c.owner && c.note ? ' · ' : ''}{c.note}</span>}
            </div>
            <button type="button" className="btn btn-outline" onClick={() => toggle(c.code)}>{c.active ? 'Switch off' : 'Switch on'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
