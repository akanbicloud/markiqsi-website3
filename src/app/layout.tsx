import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BackToTop } from '@/components/BackToTop';
import { currentUser } from '@/lib/users';
import { SITE } from '@/lib/site';

const DESCRIPTION = 'MarkIQ SI is a market intelligence platform and trading academy: alerts on big economic news from official data, news explained in plain words, trading courses, and free tools to plan, test and automate your trading, including a bot builder for MT5 and TradingView.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'MarkIQ SI · Market Intelligence & Trading Academy', template: '%s · MarkIQ SI' },
  description: DESCRIPTION,
  applicationName: 'MarkIQ SI',
  keywords: ['forex', 'trading academy', 'market news', 'economic calendar', 'forex alerts Telegram', 'trading bot builder', 'MT5 expert advisor', 'Pine Script', 'market scanner', 'risk calculator', 'prop firm challenge', 'trading journal', 'learn trading', 'Nigeria trading academy'],
  authors: [{ name: 'Oloyede Naheem Pelumi' }],
  creator: 'MarkIQ SI',
  publisher: 'MarkIQ SI',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    title: 'MarkIQ SI · Learn the Market. Build the Technology.',
    description: 'Market alerts from official data, trading courses, and the tools to build, test and run your own trading bots.',
    url: '/',
    siteName: 'MarkIQ SI',
    locale: 'en_NG',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MarkIQ SI: Learn the Market. Build the Technology.' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@MarkIQSI3',
    title: 'MarkIQ SI · Learn the Market. Build the Technology.',
    description: 'Market alerts from official data, trading courses, and the tools to build, test and run your own trading bots.',
    images: ['/og.png'],
  },
  // Optional: paste the code from Google Search Console / Bing Webmaster Tools into these Vercel settings.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

/** Structured data that tells Google and AI tools who we are and what the site is. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['Organization', 'EducationalOrganization'],
      '@id': `${SITE.url}/#org`,
      name: 'MarkIQ SI',
      alternateName: 'MarkIQ SI · Market Intelligence & Academy',
      url: SITE.url,
      logo: `${SITE.url}/favicon.svg`,
      description: DESCRIPTION,
      email: SITE.email,
      telephone: SITE.phoneIntl,
      founder: { '@type': 'Person', name: 'Oloyede Naheem Pelumi', jobTitle: 'Founder' },
      sameAs: [SITE.instagram, SITE.x, SITE.facebook, SITE.telegram].filter(Boolean),
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      url: SITE.url,
      name: 'MarkIQ SI',
      description: DESCRIPTION,
      publisher: { '@id': `${SITE.url}/#org` },
      inLanguage: 'en',
    },
  ],
};

export const viewport: Viewport = {
  themeColor: '#0B1A36',
};

const themeScript = `try{var t=localStorage.getItem('mq-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    user = await currentUser();
  } catch {
    user = null;
  }
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-friendly summary" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <a href="#main" className="sr-only">Skip to content</a>
        <Header signedIn={!!user} firstName={user?.name?.split(' ')[0] || null} />
        <main id="main">{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  );
}
