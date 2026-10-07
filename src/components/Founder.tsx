export function Founder({ label = "Who's behind MarkIQ SI", id = 'founder' }: { label?: string; id?: string }) {
  return (
    <section id={id} className="wrap row" style={{ maxWidth: 1240, padding: '110px 16px', gap: 56, alignItems: 'center' }}>
      <div style={{ flex: '0 1 380px', minWidth: 0, margin: '0 auto' }}>
        <div style={{ borderRadius: 30, overflow: 'hidden', background: 'var(--line-soft)', aspectRatio: '4 / 5' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/founder.jpg" alt="Oloyede Naheem Pelumi, founder of MarkIQ SI" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%' }} />
        </div>
      </div>
      <div className="stack" style={{ flex: '1 1 480px', minWidth: 0, gap: 20 }}>
        <span className="pill-tag" style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
        <h2 className="h2">Built by a trader, for traders.</h2>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.6, color: 'var(--text)' }}>
          I&apos;ve been trading since 2021. Through inflation shocks, rate decisions and surprise headlines, the price usually moved long before anyone explained why.
        </p>
        <p style={{ margin: 0, fontSize: 20, lineHeight: 1.6, color: 'var(--text)' }}>
          I hold a BSc in Computer Science and work as an AI and machine learning engineer, so I built the tool I wanted: official data checked by code, explained in plain words, with lessons and tools that help you understand the market yourself.
        </p>
        <div className="stack" style={{ lineHeight: 1.3, paddingTop: 6 }}>
          <span className="display" style={{ fontWeight: 700, fontSize: 22 }}>Oloyede Naheem Pelumi</span>
          <span className="faint">Founder, MarkIQ SI · AI &amp; Machine Learning Engineer</span>
        </div>
      </div>
    </section>
  );
}
