'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData, ChartEvent } from '@/lib/terminal/data';

/**
 * The MarkIQ terminal chart: candles, the glowing Pressure band (green = linked markets pushing up,
 * red = pushing down, wider = stronger), event labels pinned to the candle where they landed, a heat
 * strip, and a reveal line you can drag to replay how the picture built up.
 */

export const C = { bg: '#071226', grid: 'rgba(185,201,230,0.08)', axis: '#7F93B8', up: '#FFB547', down: '#8EA3C8', mint: '#3DDC97', coral: '#FF6B5A', text: '#EAF1FF' };

export function pressureWord(s: number | null) {
  if (s == null) return 'Not enough data';
  const a = Math.abs(s);
  const dir = s > 0 ? 'up' : 'down';
  if (a < 15) return 'Calm, no clear push';
  if (a < 40) return `Mild push ${dir}`;
  if (a < 70) return `Strong push ${dir}`;
  return `Very strong push ${dir}`;
}

export function heat(s: number | null, alpha = 1) {
  if (s == null) return `rgba(127,147,184,${0.15 * alpha})`;
  const a = Math.min(1, Math.abs(s) / 100);
  const [r, g, b] = s >= 0 ? [61, 220, 151] : [255, 107, 90];
  return `rgba(${r},${g},${b},${(0.12 + a * 0.78) * alpha})`;
}

export const fmtPrice = (v: number, d: number) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

type Props = {
  data: ChartData;
  mode?: 'hero' | 'full';
  height?: number;
  selected?: number | null;
  onSelect?: (i: number) => void;
  /** 0..1 position of the reveal line; controlled by the Replay page. */
  reveal?: number;
  onReveal?: (r: number) => void;
};

const PAD = { l: 8, r: 72, top: 64, strip: 16, axis: 22 };

export function TerminalChart({ data, mode = 'full', height = 460, selected = null, onSelect, reveal: revealProp, onReveal }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [revealState, setReveal] = useState(mode === 'hero' ? 0.04 : 1);
  const reveal = revealProp ?? revealState;
  const auto = useRef(mode === 'hero');
  const drag = useRef(false);
  const n = data.candles.length;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    setW(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // geometry
  const geo = useMemo(() => {
    const plotW = Math.max(50, w - PAD.l - PAD.r);
    const plotTop = PAD.top;
    const plotBot = height - PAD.strip - PAD.axis - 6;
    // on small screens show only as many recent candles as fit (about 3.5px each at least)
    const v0 = Math.max(0, n - Math.max(40, Math.floor(plotW / 3.5)));
    let lo = Infinity, hi = -Infinity;
    for (let i = v0; i < n; i++) { const c = data.candles[i]; lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); }
    const padP = (hi - lo) * 0.08 || 1;
    lo -= padP; hi += padP;
    const step = plotW / Math.max(1, n - v0);
    const x = (i: number) => PAD.l + step * (i - v0 + 0.5);
    const y = (p: number) => plotTop + ((hi - p) / (hi - lo)) * (plotBot - plotTop);
    return { plotW, plotTop, plotBot, lo, hi, step, x, y, v0 };
  }, [w, height, data.candles, n]);

  const visibleEvents = useMemo(() => {
    const cap = mode === 'hero' ? 10 : 18;
    const evs = data.events.filter((e) => e.i >= geo.v0);
    // keep the most important: data releases and big moves first, then the latest
    evs.sort((a, b) => (b.kind === 'data' ? 1 : 0) - (a.kind === 'data' ? 1 : 0) || Math.abs(b.move || 0) - Math.abs(a.move || 0));
    return evs.slice(0, cap).sort((a, b) => a.i - b.i);
  }, [data.events, mode, geo.v0]);

  // draw the full scene once per size/data change
  useEffect(() => {
    if (!w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const off = base.current || document.createElement('canvas');
    base.current = off;
    off.width = w * dpr; off.height = height * dpr;
    const g = off.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { x, y, plotTop, plotBot, lo, hi, step, v0 } = geo;
    g.fillStyle = C.bg; g.fillRect(0, 0, w, height);

    // grid + price axis
    g.font = '11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const p = lo + ((hi - lo) * k) / 4, yy = y(p);
      g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(PAD.l, yy); g.lineTo(w - PAD.r, yy); g.stroke();
      g.fillStyle = C.axis; g.fillText(fmtPrice(p, data.digits), w - PAD.r + 8, yy);
    }
    // day separators + time axis
    let lastDay = '', lastLabelX = -1e9;
    g.textBaseline = 'alphabetic';
    for (let i = v0; i < n; i++) {
      const c = data.candles[i];
      const d = new Date(c.t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      if (d !== lastDay) {
        if (lastDay) { g.strokeStyle = C.grid; g.beginPath(); g.moveTo(x(i) - step / 2, plotTop - 6); g.lineTo(x(i) - step / 2, plotBot); g.stroke(); }
        const lx = x(i) - step / 2 + 4, tw = g.measureText(d).width;
        if (lx + tw < w - PAD.r && lx - lastLabelX > tw + 14 && (lastDay || i > v0 + 10 || n - v0 < 30)) { g.fillStyle = C.axis; g.fillText(d, lx, height - 6); lastLabelX = lx; }
        lastDay = d;
      }
    }

    // pressure band around the closing price
    g.save();
    g.shadowBlur = 16;
    for (let i = v0 + 1; i < n; i++) {
      const a = data.candles[i - 1], b = data.candles[i];
      if (b.score == null || a.score == null) continue;
      const ha = 3 + (Math.abs(a.score) / 100) * 30, hb = 3 + (Math.abs(b.score) / 100) * 30;
      const col = heat(b.score, 0.7);
      g.shadowColor = b.score >= 0 ? 'rgba(61,220,151,0.8)' : 'rgba(255,107,90,0.8)';
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x(i - 1), y(a.c) - ha); g.lineTo(x(i), y(b.c) - hb); g.lineTo(x(i), y(b.c) + hb); g.lineTo(x(i - 1), y(a.c) + ha);
      g.closePath(); g.fill();
    }
    g.restore();

    // candles
    const bw = Math.max(1, Math.min(10, step * 0.62));
    data.candles.forEach((c, i) => {
      if (i < v0) return;
      const up = c.c >= c.o, xx = x(i);
      g.strokeStyle = up ? C.up : C.down; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xx, y(c.h)); g.lineTo(xx, y(c.l)); g.stroke();
      const top = y(Math.max(c.o, c.c)), hgt = Math.max(1, Math.abs(y(c.o) - y(c.c)));
      if (up) { g.fillStyle = C.up; g.fillRect(xx - bw / 2, top, bw, hgt); }
      else { g.fillStyle = C.bg; g.fillRect(xx - bw / 2, top, bw, hgt); g.strokeRect(xx - bw / 2 + 0.5, top + 0.5, bw - 1, Math.max(0, hgt - 1)); }
    });

    // heat strip
    const sy = plotBot + 8;
    data.candles.forEach((c, i) => { if (i < v0) return; g.fillStyle = heat(c.score); g.fillRect(x(i) - step / 2, sy, Math.ceil(step), PAD.strip - 4); });

    // event labels in up to three rows, with leader lines to the candle
    g.font = '600 11px "IBM Plex Sans", system-ui, sans-serif'; g.textBaseline = 'middle';
    const rows: number[][] = [[], [], []];
    for (const e of visibleEvents) {
      const c = data.candles[e.i];
      if (!c || e.i < v0) continue;
      const arrow = e.dir === 'up' ? ' ▲' : e.dir === 'down' ? ' ▼' : '';
      const text = `${e.icon} ${e.head}${e.count > 1 ? ` ×${e.count}` : ''}${arrow}`;
      const tw = Math.min(170, g.measureText(text).width + 14);
      const lx = Math.min(w - PAD.r - tw - 2, Math.max(PAD.l, x(e.i) - tw / 2));
      const r = rows.findIndex((row) => row.every((end, k) => k % 2 === 1 || !(lx < row[k + 1] + 6 && lx + tw + 6 > end)));
      if (r < 0) continue;
      rows[r].push(lx, lx + tw);
      const ly = 12 + r * 18;
      const col = e.dir === 'up' ? C.mint : e.dir === 'down' ? C.coral : C.axis;
      g.strokeStyle = col; g.globalAlpha = 0.5; g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(x(e.i), ly + 8); g.lineTo(x(e.i), y(c.h) - 3); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      g.fillStyle = 'rgba(11,26,54,0.92)'; g.strokeStyle = col; g.lineWidth = 1;
      g.beginPath(); g.roundRect(lx, ly - 8, tw, 16, 8); g.fill(); g.stroke();
      g.save(); g.beginPath(); g.rect(lx + 6, ly - 8, tw - 12, 16); g.clip();
      g.fillStyle = C.text; g.fillText(text, lx + 7, ly + 0.5); g.restore();
      g.fillStyle = col; g.beginPath(); g.arc(x(e.i), y(c.h) - 3, 2.5, 0, Math.PI * 2); g.fill();
    }
  }, [w, height, data, geo, n, visibleEvents]);

  // per-frame composition: reveal, crosshair, selection
  const paint = useCallback(() => {
    const cv = canvas.current, off = base.current;
    if (!cv || !off || !w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = height * dpr; }
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const rx = Math.round((PAD.l + geo.plotW * reveal) * dpr);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(off, 0, 0, rx, cv.height, 0, 0, rx, cv.height);
    if (rx < cv.width) {
      g.fillStyle = C.bg; g.fillRect(rx, 0, cv.width - rx, cv.height);
      g.globalAlpha = 0.16; g.drawImage(off, rx, 0, cv.width - rx, cv.height, rx, 0, cv.width - rx, cv.height); g.globalAlpha = 1;
      // keep the price axis readable
      const ax = (w - PAD.r) * dpr;
      g.drawImage(off, ax, 0, cv.width - ax, cv.height, ax, 0, cv.width - ax, cv.height);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const X = PAD.l + geo.plotW * reveal;
    {
      g.save(); g.shadowColor = C.up; g.shadowBlur = 14; g.strokeStyle = C.up; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X, 4); g.lineTo(X, height - PAD.axis); g.stroke(); g.restore();
      g.fillStyle = C.up; g.beginPath(); g.roundRect(X - 9, height / 2 - 16, 18, 32, 9); g.fill();
      g.strokeStyle = C.bg; g.lineWidth = 1.5;
      for (const d of [-4, 0, 4]) { g.beginPath(); g.moveTo(X + d, height / 2 - 7); g.lineTo(X + d, height / 2 + 7); g.stroke(); }
    }
    const mark = (i: number, col: string) => {
      const xx = geo.x(i);
      g.strokeStyle = col; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(xx, geo.plotTop - 8); g.lineTo(xx, geo.plotBot + PAD.strip); g.stroke(); g.setLineDash([]);
    };
    if (selected != null && selected < n && selected >= geo.v0) mark(selected, C.up);
    if (hover && !drag.current) {
      mark(hover.i, 'rgba(234,241,255,0.5)');
      const c = data.candles[hover.i];
      if (c) {
        const yy = geo.y(c.c);
        g.fillStyle = C.up; g.fillRect(w - PAD.r + 2, yy - 9, PAD.r - 4, 18);
        g.fillStyle = C.bg; g.font = '600 11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
        g.fillText(fmtPrice(c.c, data.digits), w - PAD.r + 6, yy + 0.5);
      }
    }
  }, [w, height, geo, reveal, hover, selected, n, data, mode]);

  useEffect(() => { paint(); }, [paint]);

  // hero autoplay: sweep the reveal line, hold, repeat (until the visitor touches it)
  useEffect(() => {
    if (mode !== 'hero' || revealProp != null) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { auto.current = false; setReveal(1); return; }
    let raf = 0, t0 = 0;
    const tick = (t: number) => {
      if (!auto.current) return;
      if (!t0) t0 = t;
      const cyc = ((t - t0) / 1000) % 13;
      setReveal(cyc < 10 ? 0.04 + (cyc / 10) * 0.96 : 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, revealProp]);

  const idxAt = (px: number) => Math.max(geo.v0, Math.min(n - 1, geo.v0 + Math.floor((px - PAD.l) / geo.step)));
  const setR = (px: number) => {
    const r = Math.max(0.02, Math.min(1, (px - PAD.l) / geo.plotW));
    if (onReveal) onReveal(r); else setReveal(r);
  };
  const local = (e: React.PointerEvent) => { const b = canvas.current!.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };

  const h = hover ? data.candles[hover.i] : null;
  const hEvents: ChartEvent[] = hover ? data.events.filter((e) => e.i === hover.i) : [];

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%', height, borderRadius: 18, overflow: 'hidden', background: C.bg, touchAction: 'pan-y' }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={`${data.label} one-hour chart with MarkIQ Pressure band and ${data.events.length} market events marked`}
        style={{ width: '100%', height, display: 'block', cursor: drag.current ? 'grabbing' : 'crosshair' }}
        onPointerDown={(e) => {
          const p = local(e);
          auto.current = false;
          const X = PAD.l + geo.plotW * reveal;
          if (Math.abs(p.x - X) < 16) { drag.current = true; (e.target as Element).setPointerCapture(e.pointerId); return; }
          if (p.x < w - PAD.r) onSelect?.(idxAt(p.x));
        }}
        onPointerMove={(e) => {
          const p = local(e);
          if (drag.current) { setR(p.x); return; }
          if (p.x > w - PAD.r) { setHover(null); return; }
          setHover({ i: idxAt(p.x), x: p.x, y: p.y });
        }}
        onPointerUp={() => { drag.current = false; }}
        onPointerLeave={() => { if (!drag.current) setHover(null); }}
      />
      {h && hover && (
        <div
          style={{
            position: 'absolute', top: 70, left: hover.x > w / 2 ? Math.max(6, hover.x - 266) : Math.min(w - 266, hover.x + 16), width: 250,
            background: 'rgba(11,26,54,0.96)', border: '1px solid #2B4A82', borderRadius: 14, padding: '10px 12px', color: C.text, fontSize: 13, pointerEvents: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          <div className="mono" style={{ fontSize: 12, color: '#9FB2D6' }}>{new Date(h.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          <div className="mono" style={{ fontSize: 15, margin: '2px 0 6px' }}>
            {fmtPrice(h.c, data.digits)} <span style={{ color: h.c >= h.o ? C.mint : C.coral }}>{h.o ? `${h.c >= h.o ? '+' : ''}${(((h.c - h.o) / h.o) * 100).toFixed(2)}%` : ''}</span>
          </div>
          <div style={{ fontWeight: 700, color: h.score == null ? '#9FB2D6' : h.score >= 0 ? C.mint : C.coral }}>
            Pressure {h.score == null ? '·' : `${h.score > 0 ? '+' : ''}${h.score}`} · {pressureWord(h.score)}
          </div>
          {h.parts.length > 0 && (
            <div style={{ display: 'grid', gap: 3, marginTop: 6 }}>
              {h.parts.map((p) => (
                <div key={p.label} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 34px', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: '#B9C9E6' }}>{p.label}</span>
                  <span style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <span style={{ position: 'absolute', top: 0, bottom: 0, left: p.value >= 0 ? '50%' : `${50 + p.value / 2}%`, width: `${Math.abs(p.value) / 2}%`, background: p.value >= 0 ? C.mint : C.coral, borderRadius: 3 }} />
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>{p.value > 0 ? '+' : ''}{p.value}</span>
                </div>
              ))}
            </div>
          )}
          {hEvents.map((e) => (
            <div key={`${e.t}${e.head}`} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #1C3563' }}>
              <div style={{ fontWeight: 600 }}>{e.icon} {e.head}{e.count > 1 ? ` ×${e.count}` : ''}</div>
              {e.detail && <div style={{ color: '#B9C9E6', fontSize: 12 }}>{e.detail}</div>}
            </div>
          ))}
          {onSelect && <div style={{ marginTop: 6, color: C.up, fontSize: 12 }}>Click to see why it moved</div>}
        </div>
      )}
    </div>
  );
}
