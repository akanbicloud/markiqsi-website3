import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Get Started', description: 'Create a free MarkIQ SI account to get Telegram market alerts, save bots and backtests, and keep a trading journal.', alternates: { canonical: '/get-started' }, openGraph: { title: 'Get Started · MarkIQ SI', description: 'Create a free MarkIQ SI account to get Telegram market alerts, save bots and backtests, and keep a trading journal.', url: '/get-started', images: ['/og.png'] } };

export default async function GetStartedPage() {
  if (await getSession()) redirect('/account');
  return <AuthForm initialMode="signup" />;
}
