import type { Metadata } from 'next';
import { loadMarketData } from '@/lib/markets';
import { MarketsView } from '@/components/markets/MarketsView';
import { getSession } from '@/lib/session';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Markets', description: 'This week’s big economic events, central bank interest rates, official results and market news from the US, UK, Europe, Japan, China, Canada and Australia, explained in plain words. Ask MarkIQ about any currency pair or asset.', alternates: { canonical: '/markets' }, openGraph: { title: 'Markets · MarkIQ SI', description: 'This week’s big economic events, central bank interest rates, official results and market news from the US, UK, Europe, Japan, China, Canada and Australia, explained in plain words. Ask MarkIQ about any currency pair or asset.', url: '/markets', images: ['/og.png'] } };

// Lets the background refresh (calendar + news) finish after the page is sent.
export const maxDuration = 60;

export default async function MarketsPage() {
  const [data, s] = await Promise.all([loadMarketData(), getSession()]);
  return <MarketsView data={data} signedIn={!!s} telegramUrl={SITE.telegram} />;
}
