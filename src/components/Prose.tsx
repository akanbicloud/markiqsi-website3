import type { Section } from '@/lib/content/legal';

export function LegalDoc({ title, intro, sections, prefix }: { title: string; intro: string; sections: Section[]; prefix: string }) {
  return (
    <>
      <section className="hero-band stack center" style={{ padding: '90px 16px 40px', textAlign: 'center' }}>
        <div className="stack center" style={{ maxWidth: 980, gap: 18 }}>
          <h1 className="h1 rise" style={{ fontSize: 'clamp(40px, 6vw, 84px)' }}>{title}</h1>
          <p className="lead rise d1" style={{ maxWidth: 720 }}>{intro}</p>
          <span className="faint">Last updated: 7 October 2026</span>
        </div>
      </section>
      <section className="wrap" style={{ maxWidth: 1180, padding: '20px 16px 110px' }}>
        <div className="row" style={{ gap: 28, alignItems: 'flex-start' }}>
          <nav aria-label="On this page" className="card stack" style={{ flex: '0 1 280px', position: 'sticky', top: 20, gap: 8, padding: 22 }}>
            <span style={{ fontWeight: 700, marginBottom: 4 }}>On this page</span>
            {sections.map((s, i) => (
              <a key={s.title} href={`#${prefix}-${i + 1}`} style={{ fontSize: 15, color: 'var(--text)', textDecoration: 'none' }}>
                {i + 1}. {s.title}
              </a>
            ))}
          </nav>
          <div className="card-lg stack" style={{ flex: '1 1 560px', minWidth: 0, gap: 34 }}>
            {sections.map((s, i) => (
              <div key={s.title} id={`${prefix}-${i + 1}`} className="stack" style={{ gap: 12, scrollMarginTop: 20 }}>
                <h2 className="display" style={{ fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em' }}>
                  {i + 1}. {s.title}
                </h2>
                {s.paras.map((p) => (
                  <p key={p} style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: 'var(--text)' }}>{p}</p>
                ))}
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 22, color: 'var(--text)' }}>
              Questions about this document? Email <a href="mailto:markiqsi2@gmail.com">markiqsi2@gmail.com</a> or WhatsApp <a href="https://wa.me/2349016771255">+234 901 677 1255</a>.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
