import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolsView } from '@/components/tools/ToolsView';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Free Trading Tools', description: 'Free trading tools: Risk Calculator, Prop Challenge Tracker, Market Scanner (supply and demand, ICT, SMC, candle patterns, 1 minute to monthly), charts with bar replay, Bot Builder for MT5 and TradingView, and a Trading Journal.', alternates: { canonical: '/tools' }, openGraph: { title: 'Free Trading Tools · MarkIQ SI', description: 'Free trading tools: Risk Calculator, Prop Challenge Tracker, Market Scanner (supply and demand, ICT, SMC, candle patterns, 1 minute to monthly), charts with bar replay, Bot Builder for MT5 and TradingView, and a Trading Journal.', url: '/tools', images: ['/og.png'] } };

export default async function ToolsPage() {
  const s = await getSession();
  return (
    <Suspense fallback={null}>
      <ToolsView signedIn={!!s} />
    </Suspense>
  );
}
