import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/AuthForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Log in', description: 'Log in to MarkIQ SI with a secure email link.', alternates: { canonical: '/login' }, openGraph: { title: 'Log in · MarkIQ SI', description: 'Log in to MarkIQ SI with a secure email link.', url: '/login', images: ['/og.png'] } };

export default async function LoginPage() {
  if (await getSession()) redirect('/account');
  return <AuthForm initialMode="login" />;
}
