import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/users';
import { AccountPanel } from '@/components/AccountPanel';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage() {
  const u = await currentUser().catch(() => null);
  if (!u) redirect('/login');
  return (
    <AccountPanel
      user={{ name: u.name || '', email: u.email, goal: u.goal || 'learn', level: u.level || 'new', markets: u.markets, telegram: !!u.telegram_chat_id, telegramUser: u.telegram_username || '' }}
      telegramReady={!!process.env.TELEGRAM_BOT_USERNAME}
    />
  );
}
