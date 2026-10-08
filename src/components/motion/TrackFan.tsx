'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export type Track = { title: string; level: string; bg: string; fg: string; points: string[] };

const ease = [0.16, 1, 0.3, 1] as const;
const EVERY_MS = 4000;

/** Where each fan position sits: d = -2 (far left) … 0 (centre) … 2 (far right). */
function slot(d: number, w: number) {
  const a = Math.abs(d);
  const small = w < 760;
  const near = small ? Math.min(300, w * 0.36) : Math.min(300, w * 0.22);
  const far = small ? w * 0.75 : Math.min(575, w * 0.43);
  return {
    x: Math.sign(d) * (a === 0 ? 0 : a === 1 ? near : far),
    y: a === 0 ? 0 : a === 1 ? 26 : 90,
    rotate: Math.sign(d) * (a === 0 ? 0 : a === 1 ? 8 : 17),
    scale: a === 0 ? 1.06 : small ? 0.9 : 1,
    opacity: small && a === 2 ? 0 : 1,
    zIndex: a === 0 ? 5 : a === 1 ? 3 : 1,
  };
}

/** The course cards in a fan. Every few seconds they move round so each card takes its turn in the middle. */
export function TrackFan({ tracks }: { tracks: Track[] }) {
  const n = tracks.length;
  const still = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1340);
  const [active, setActive] = useState(Math.floor(n / 2));
  const [hold, setHold] = useState(false); // hover, focus or touch
  const [paused, setPaused] = useState(false); // the pause button
  const lastActive = useRef(active); // where the fan was before this move
  useEffect(() => { lastActive.current = active; }, [active]);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (still || hold || paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), EVERY_MS);
    return () => clearInterval(t);
  }, [still, hold, paused, n]);

  const go = (step: number) => setActive((a) => (a + step + n) % n);
  const offsetFor = (i: number, a: number) => ((i - a + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div
        ref={box}
        className="fan"
        role="region"
        aria-roledescription="carousel"
        aria-label="Courses"
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false); }}
        onTouchStart={(e) => { setHold(true); touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const s = touchX.current;
          touchX.current = null;
          if (s != null) {
            const dx = e.changedTouches[0].clientX - s;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }
          setTimeout(() => setHold(false), 2500);
        }}
      >
        <div className="fan-bg" aria-hidden="true" />
        {tracks.map((t, i) => {
          const d = offsetFor(i, active);
          const wrapped = Math.abs(offsetFor(i, lastActive.current) - d) > 2; // jumped from one end of the fan to the other
          const s = slot(d, w);
          const light = t.fg === '#FFFFFF';
          const centre = d === 0;
          return (
            <motion.article
              key={t.title}
              className="fan-card stripes"
              aria-hidden={!centre && Math.abs(d) === 2 && w < 760 ? true : undefined}
              aria-label={`${t.title}, course ${i + 1} of ${n}`}
              style={{ backgroundColor: t.bg, color: t.fg, zIndex: s.zIndex, cursor: centre ? 'default' : 'pointer' }}
              initial={false}
              animate={wrapped ? { x: s.x, y: s.y, rotate: s.rotate, scale: s.scale, opacity: [0, s.opacity] } : { x: s.x, y: s.y, rotate: s.rotate, scale: s.scale, opacity: s.opacity }}
              transition={still ? { duration: 0 } : wrapped ? { x: { duration: 0 }, y: { duration: 0 }, rotate: { duration: 0 }, scale: { duration: 0 }, opacity: { duration: 0.6, ease } } : { duration: 0.9, ease }}
              whileHover={centre && !still ? { y: -12, transition: { duration: 0.4, ease } } : undefined}
              onClick={() => { if (!centre) setActive(i); }}
            >
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
                tabIndex={centre ? 0 : -1}
                onClick={(e) => { if (!centre) e.preventDefault(); }}
                style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '0 28px', borderRadius: 999, fontWeight: 600, fontSize: 18, textDecoration: 'none', color: t.fg, border: `1.5px solid ${light ? 'rgba(255,255,255,0.7)' : 'rgba(11,26,54,0.45)'}` }}
              >
                See course <span aria-hidden="true">»</span>
              </Link>
            </motion.article>
          );
        })}
      </div>
      <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <button type="button" className="toggle fan-btn" aria-label="Previous course" onClick={() => go(-1)}>‹</button>
        <div className="row" style={{ gap: 6 }} aria-label="Choose a course">
          {tracks.map((t, i) => (
            <button key={t.title} type="button" className="fan-dot" aria-label={t.title} aria-current={i === active ? 'true' : undefined} onClick={() => setActive(i)} />
          ))}
        </div>
        <button type="button" className="toggle fan-btn" aria-label="Next course" onClick={() => go(1)}>›</button>
        {!still && (
          <button type="button" className="toggle" style={{ fontSize: 14, minHeight: 38, padding: '0 16px' }} aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>
    </div>
  );
}
