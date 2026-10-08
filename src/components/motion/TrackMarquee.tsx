'use client';

import Link from 'next/link';
import { useState } from 'react';

export type Track = { title: string; level: string; bg: string; fg: string; points: string[] };

function Card({ t }: { t: Track }) {
  const light = t.fg === '#FFFFFF';
  return (
    <article className="mq-card stripes" style={{ backgroundColor: t.bg, color: t.fg }}>
      <span style={{ fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 999, background: light ? 'rgba(255,255,255,0.18)' : 'rgba(11,26,54,0.12)' }}>{t.level}</span>
      <h3 className="display" style={{ fontSize: 36, lineHeight: 1.04, letterSpacing: '-0.025em' }}>{t.title}</h3>
      <div className="stack" style={{ gap: 12 }}>
        {t.points.map((p) => (
          <div key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 17, lineHeight: 1.4, color: light ? 'rgba(255,255,255,0.92)' : 'rgba(11,26,54,0.88)' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 9, height: 9, borderRadius: '50%', marginTop: 8, background: light ? '#FFB547' : '#0B1A36' }} />
            <span>{p}</span>
          </div>
        ))}
      </div>
      <Link
        href="/get-started"
        style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '0 28px', borderRadius: 999, fontWeight: 600, fontSize: 18, textDecoration: 'none', color: t.fg, border: `1.5px solid ${light ? 'rgba(255,255,255,0.7)' : 'rgba(11,26,54,0.45)'}` }}
      >
        See course <span aria-hidden="true">»</span>
      </Link>
    </article>
  );
}

/** Course cards sliding past in an endless loop. Pauses on hover, on keyboard focus, or with the pause button. */
export function TrackMarquee({ tracks }: { tracks: Track[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="mq-marquee" data-paused={paused} role="region" aria-label="Courses">
        <div className="mq-track">
          <div className="mq-set">{tracks.map((t) => <Card key={t.title} t={t} />)}</div>
          {/* A second copy makes the loop seamless. Screen readers and the keyboard skip it. */}
          <div className="mq-set" aria-hidden="true" inert>{tracks.map((t) => <Card key={t.title} t={t} />)}</div>
        </div>
      </div>
      <button type="button" className="mq-pause toggle" style={{ alignSelf: 'center', fontSize: 14, minHeight: 38, padding: '0 16px' }} aria-pressed={paused} onClick={() => setPaused(!paused)}>
        {paused ? 'Play cards' : 'Pause cards'}
      </button>
    </div>
  );
}
