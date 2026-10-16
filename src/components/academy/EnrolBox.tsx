'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Option = { key: string; format: 'online' | 'physical'; currency: 'NGN' | 'USD'; label: string; list: string; now: string; onOffer: boolean };

export function EnrolBox({ slug, options, address }: { slug: string; options: Option[]; address: string }) {
  const [me, setMe] = useState<'loading' | 'in' | 'out'>('loading');
  const [pick, setPick] = useState(options[0].key);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string; href?: string } | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; label: string; now: string; was: string; key: string } | null>(null);
  const [codeErr, setCodeErr] = useState('');

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setMe(d.user ? 'in' : 'out')).catch(() => setMe('out'));
    try {
      const ref = new URLSearchParams(window.location.search).get('ref') || localStorage.getItem('mq_ref');
      if (ref) { setCode(ref.toUpperCase()); setCodeOpen(true); }
    } catch {}
  }, []);

  const opt = options.find((o) => o.key === pick) || options[0];
  const price = applied && applied.key === opt.key ? applied.now : opt.now;

  async function checkCode(c = code, o = opt) {
    setCodeErr('');
    if (!c.trim()) { setApplied(null); return; }
    try {
      const r = await fetch('/api/courses/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: c, slug, format: o.format, currency: o.currency }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setApplied(null); setCodeErr(d.error || 'That code is not valid.'); return; }
      setApplied({ code: d.code, label: d.label, now: d.now, was: d.was, key: o.key });
    } catch {
      setCodeErr('Could not check the code. Please try again.');
    }
  }

  useEffect(() => {
    if (applied && applied.key !== opt.key) checkCode(applied.code, opt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  function signIn() {
    try {
      localStorage.setItem('mq_next', `/courses/${slug}`);
    } catch {}
    window.location.href = '/login';
  }

  async function enrol() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/courses/enrol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, format: opt.format, currency: opt.currency, code: applied?.code || '' }) });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return signIn();
      if (!r.ok || !d.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
      if (d.manual) {
        setMsg({ kind: 'ok', text: `Your place is reserved (reference ${d.reference}). Send us the WhatsApp message to get payment details. Your course opens as soon as payment is confirmed.`, href: d.url });
        window.open(d.url, '_blank', 'noopener');
      } else {
        window.location.href = d.url;
      }
    } catch (e) {
      setMsg({ kind: 'bad', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-lg stack" style={{ gap: 16 }}>
      <h2 className="display" style={{ fontWeight: 700, fontSize: 26, margin: 0 }}>Enrol</h2>
      <div className="stack" style={{ gap: 10 }} role="radiogroup" aria-label="Class type">
        {options.map((o) => (
          <label key={o.key} className="card row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap', cursor: 'pointer', padding: '14px 16px', borderColor: pick === o.key ? 'var(--ink)' : undefined }}>
            <input type="radio" name="opt" checked={pick === o.key} onChange={() => setPick(o.key)} />
            <span style={{ flex: 1 }}>{o.label}</span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <strong style={{ fontSize: 20 }}>{o.now}</strong>
              {o.onOffer && <span className="faint" style={{ display: 'block', textDecoration: 'line-through', fontSize: 14 }}>{o.list}</span>}
            </span>
          </label>
        ))}
      </div>
      {opt.format === 'physical' && <p className="muted" style={{ margin: 0 }}>Classes hold at {address}.</p>}
      {codeOpen ? (
        <div className="stack" style={{ gap: 8 }}>
          <label className="field" style={{ margin: 0 }}>Discount or referral code
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input className="input" value={code} maxLength={24} onChange={(e) => { setCode(e.target.value.toUpperCase()); setApplied(null); }} placeholder="e.g. LAUNCH10" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="btn btn-outline" onClick={() => checkCode()}>Apply</button>
            </div>
          </label>
          {applied && applied.key === opt.key && <span className="note note-ok" style={{ margin: 0 }}>Code {applied.code}: {applied.label}. You pay {applied.now} instead of {applied.was}.</span>}
          {codeErr && <span className="note note-bad" style={{ margin: 0 }}>{codeErr}</span>}
        </div>
      ) : (
        <button type="button" className="linkbtn" style={{ alignSelf: 'flex-start' }} onClick={() => setCodeOpen(true)}>Have a discount or referral code?</button>
      )}
      {me === 'out' ? (
        <>
          <button type="button" className="btn btn-lg" onClick={signIn}>Sign in to enrol <span className="arr" aria-hidden="true">»</span></button>
          <p className="faint" style={{ margin: 0, fontSize: 14 }}>A free account is needed to enrol and open your lessons. We email you a sign-in link, no password.</p>
        </>
      ) : (
        <button type="button" className="btn btn-lg" onClick={enrol} disabled={busy || me === 'loading'}>
          {busy ? <span className="spinner" aria-label="Please wait" /> : <>Enrol for {price}</>} <span className="arr" aria-hidden="true">»</span>
        </button>
      )}
      {msg && (
        <div role="status" className={`note ${msg.kind === 'ok' ? 'note-ok' : 'note-bad'}`}>
          {msg.text} {msg.href && <a href={msg.href} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>}
        </div>
      )}
      <p className="faint" style={{ margin: 0, fontSize: 14 }}>
        Questions first? <Link href="/academy">About the Academy</Link>
      </p>
    </div>
  );
}
