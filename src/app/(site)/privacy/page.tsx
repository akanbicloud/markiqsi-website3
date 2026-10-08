import type { Metadata } from 'next';
import { LegalDoc } from '@/components/Prose';
import { PRIVACY } from '@/lib/content/legal';

export const metadata: Metadata = { title: 'Privacy Policy', description: 'How MarkIQ SI collects, uses and protects your information.', alternates: { canonical: '/privacy' }, openGraph: { title: 'Privacy Policy · MarkIQ SI', description: 'How MarkIQ SI collects, uses and protects your information.', url: '/privacy', images: ['/og.png'] } };

export default function PrivacyPage() {
  return <LegalDoc title="Privacy Policy" intro="What data we collect, why we collect it, and how we protect it." sections={PRIVACY} prefix="privacy" />;
}
