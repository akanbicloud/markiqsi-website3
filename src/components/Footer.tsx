import Link from 'next/link';
import { SITE } from '@/lib/site';
import { SocialRow } from './Social';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap stack" style={{ paddingTop: 56, paddingBottom: 56, gap: 26 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 22, alignItems: 'center' }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 24 }}>
            MarkIQ SI{' '}
            <span style={{ fontFamily: 'var(--body)', fontWeight: 400, fontSize: 15, color: '#B9C9E6', marginLeft: 8 }}>
              {SITE.tagline}
            </span>
          </span>
          <nav aria-label="Footer" className="row" style={{ gap: '10px 26px', fontSize: 16 }}>
            <Link href="/#learn">Learn</Link>
            <Link href="/markets">Markets</Link>
            <Link href="/tools">Tools</Link>
            <Link href="/about">About</Link>
            <Link href="/faqs">FAQs</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 22, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
          <SocialRow />
          <div className="row" style={{ gap: '8px 26px', fontSize: 16 }}>
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            <a href={`tel:${SITE.phoneTel}`}>Call or WhatsApp: {SITE.phoneIntl}</a>
            <a href="https://markiqsi.com">markiqsi.com</a>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#B9C9E6', maxWidth: 960 }}>
          Risk warning: trading currencies, commodities, indices, stocks and crypto, especially with leverage, carries a high risk of loss and may not be suitable for everyone. MarkIQ SI provides market information and education, not investment advice.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#B9C9E6' }}>© {new Date().getFullYear()} MarkIQ SI</p>
      </div>
    </footer>
  );
}
