import { SITE } from '@/lib/site';
import { BrandIcon, SocialRow } from './Social';

export function HelpBlock() {
  return (
    <section style={{ padding: '0 16px 110px' }}>
      <div
        className="wrap-wide stack center"
        style={{ borderRadius: 40, background: 'linear-gradient(180deg, #123F86 0%, #1F6FE5 55%, #3A86EC 100%)', padding: '100px 24px', gap: 26, color: '#FFFFFF' }}
      >
        <span style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 999, padding: '12px 28px', fontSize: 18, fontWeight: 500 }}>Physical classes + virtual sessions</span>
        <h2 className="display" style={{ fontWeight: 700, fontSize: 'clamp(42px, 6.4vw, 92px)', lineHeight: 0.98, letterSpacing: '-0.035em' }}>
          Need Personalised
          <br />
          Help?
        </h2>
        <p style={{ margin: 0, fontSize: 22, color: '#E3EEFF', maxWidth: 680 }}>Our team will answer your questions and guide you through your first steps, in class or online.</p>
        <div className="row" style={{ justifyContent: 'center', gap: 14, marginTop: 6 }}>
          <a href={`tel:${SITE.phoneTel}`} className="btn" style={{ background: '#0B1A36', color: '#FFFFFF' }}>
            Call {SITE.phoneDisplay}
          </a>
          <a href={SITE.whatsapp} className="btn btn-white" target="_blank" rel="noopener noreferrer">
            <BrandIcon name="whatsapp" color="#128C4A" /> WhatsApp us
          </a>
          <a href={`mailto:${SITE.email}`} className="btn btn-ghost-light">
            Email us <span aria-hidden="true" style={{ color: '#FFB547' }}>»</span>
          </a>
        </div>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: '14px 24px', marginTop: 10 }}>
          <SocialRow />
          <a href="https://markiqsi.com" style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 19, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.6)' }}>
            markiqsi.com
          </a>
          <a href={`mailto:${SITE.email}`} style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 19, textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.6)' }}>
            {SITE.email}
          </a>
        </div>
      </div>
    </section>
  );
}
