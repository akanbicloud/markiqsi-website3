'use client';

import { useEffect, useRef } from 'react';
import { CandlestickSeries, createChart, LineStyle, type UTCTimestamp } from 'lightweight-charts';

type Candle = { t: number; o: number; h: number; l: number; c: number };
type Zone = { id: string; side: 'support' | 'resistance'; price: number; low: number; high: number; score: number };
type Plan = { id: string; bias: 'Bullish' | 'Bearish'; trigger: number; invalidation: number; target: number | null };

/** The real candles with our key zones and the favoured plan drawn on them. */
export function ZoneChart({ candles, zones, plan, digits }: { candles: Candle[]; zones: Zone[]; plan: Plan | null; digits: number }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current || candles.length < 2) return;
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { color: '#FFFFFF' }, textColor: '#3A4A66', fontFamily: 'IBM Plex Sans, system-ui, sans-serif' },
      grid: { vertLines: { color: '#F3EEE5' }, horzLines: { color: '#F3EEE5' } },
      rightPriceScale: { borderColor: '#E2DACB' },
      timeScale: { borderColor: '#E2DACB', timeVisible: true, secondsVisible: false, rightOffset: 8 },
      crosshair: { mode: 2 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#16A34A', downColor: '#E0592A', borderVisible: false, wickUpColor: '#16A34A', wickDownColor: '#E0592A',
      priceFormat: { type: 'price', precision: digits, minMove: 10 ** -digits },
    });
    series.setData(candles.map((b) => ({ time: Math.floor(b.t / 1000) as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })));
    for (const z of zones) {
      const colour = z.side === 'resistance' ? '#E0592A' : '#16A34A';
      series.createPriceLine({ price: z.price, color: colour, lineWidth: z.score >= 4 ? 2 : 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: z.id });
    }
    if (plan) {
      series.createPriceLine({ price: plan.trigger, color: '#0B1A36', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: `${plan.id} trigger` });
      series.createPriceLine({ price: plan.invalidation, color: '#7A2508', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: `${plan.id} wrong if` });
      if (plan.target != null) series.createPriceLine({ price: plan.target, color: '#0B4A2E', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: `${plan.id} aim` });
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [candles, zones, plan, digits]);

  return <div ref={box} style={{ height: 'clamp(280px, 50vw, 420px)', width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)' }} aria-label="Price chart with key zones" role="img" />;
}
