'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Option = { key: string; format: 'online' | 'physical'; currency: 'NGN' | 'USD'; label: string; list: string; now: string; onOffer: boolean };

export function EnrolBox({ slug, options, address }: { slug: string; options: Option[]; address: string }) {
  const [me, setMe] = useState<'loading' | 'in' | 'out'>('loading');
  const [pick, setPick] = useState(options[0].key);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'bad'; text: string; href?: string } | null>(null);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => setMe(d.user ? 'in' : 'out')).catch(() => setMe('out'));
  }, []);

  const opt = options.find((o) => o.key === pick) || options[0];

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
      const r = await fetch('/api/courses/enrol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, format: opt.format, currency: opt.currency }) });
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
      {me === 'out' ? (
        <>
          <button type="button" className="btn btn-lg" onClick={signIn}>Sign in to enrol <span className="arr" aria-hidden="true">»</span></button>
          <p className="faint" style={{ margin: 0, fontSize: 14 }}>A free account is needed to enrol and open your lessons. We email you a sign-in link, no password.</p>
        </>
      ) : (
        <button type="button" className="btn btn-lg" onClick={enrol} disabled={busy || me === 'loading'}>
          {busy ? <span className="spinner" aria-label="Please wait" /> : <>Enrol for {opt.now}</>} <span className="arr" aria-hidden="true">»</span>
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
