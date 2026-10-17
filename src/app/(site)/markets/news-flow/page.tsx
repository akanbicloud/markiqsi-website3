import type { Metadata } from 'next';
import { hasDb } from '@/lib/db';
import { newsFlow, toneStrip, type FlowItem } from '@/lib/terminal/newsflow';
import { MarketsNav } from '@/components/terminal/MarketsNav';
import { NewsFlowView } from '@/components/terminal/NewsFlowView';

export const metadata: Metadata = {
  title: 'News Flow',
  description: 'Market news tagged by story, with the central bank tone, the war and geopolitics tone, a Trump tracker and the chain from each headline to the markets it moves.',
  alternates: { canonical: '/markets/news-flow' },
};

export default async function NewsFlowPage() {
  let items: FlowItem[] = [];
  let error = '';
  if (hasDb()) items = await newsFlow().then((d) => d.items).catch(() => { error = 'News Flow is temporarily unavailable.'; return []; });
  else error = 'News Flow is not connected yet.';
  return (
    <>
      <MarketsNav active="/markets/news-flow" />
      <NewsFlowView items={items} tone={toneStrip(items)} error={error} />
    </>
  );
}
