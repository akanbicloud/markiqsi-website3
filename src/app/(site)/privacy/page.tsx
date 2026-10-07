import type { Metadata } from 'next';
import { LegalDoc } from '@/components/Prose';
import { PRIVACY } from '@/lib/content/legal';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return <LegalDoc title="Privacy Policy" intro="What data we collect, why we collect it, and how we protect it." sections={PRIVACY} prefix="privacy" />;
}
