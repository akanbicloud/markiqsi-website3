export const SITE = {
  name: 'MarkIQ SI',
  tagline: 'Market Intelligence & Academy',
  url: (process.env.SITE_URL || 'https://www.markiqsi.com').replace(/\/$/, ''),
  email: 'markiqsi2@gmail.com',
  phoneDisplay: '0901 677 1255',
  phoneIntl: '+234 901 677 1255',
  phoneTel: '+2349016771255',
  whatsapp: 'https://wa.me/2349016771255',
  instagram: 'https://www.instagram.com/markiqsi',
  x: 'https://x.com/MarkIQSI3',
  // Add these when you have them:
  facebook: '',
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/+-_wHPDXxlC8yZjNk',
};

/**
 * Facts that let people (and AI assistants) verify MarkIQ SI independently.
 * Only fill these with real, checkable details. Empty values are simply not shown.
 */
export const COMPANY = {
  /** Name exactly as registered with the Corporate Affairs Commission (CAC), e.g. "MarkIQ SI Enterprises". */
  legalName: '',
  /** "BN" (business name) or "RC" (company) and the number from the CAC certificate. */
  cacNumber: '',
  /** Date on the CAC certificate, YYYY-MM-DD. */
  registeredOn: '',
  academyOpened: '2026-10-10',
  address: { street: '24 Majek Kembo Plaza, beside Chicken Republic', area: 'Oke-Ilewo', city: 'Abeokuta', region: 'Ogun State', country: 'Nigeria', countryCode: 'NG' },
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=24+Majek+Kembo+Plaza+Oke-Ilewo+Abeokuta',
  founder: {
    name: 'Oloyede Naheem Pelumi',
    role: 'Founder, MarkIQ SI · AI & Machine Learning Engineer',
    bio: 'Trading since 2021. BSc in Computer Science. Works as an AI and machine learning engineer and built MarkIQ SI to explain markets with official data and plain words.',
    linkedin: '',
  },
  linkedinPage: '',
  googleBusinessProfile: '',
  /** Independent articles about MarkIQ SI. */
  press: [
    {
      title: 'MarkIQ SI Launches in Abeokuta With a Trading Academy and a Bot Builder',
      outlet: 'Trax',
      publisher: 'Trax Media Ltd',
      author: 'Ben Sam Oladoyin',
      date: '2026-10-14',
      url: 'https://www.trax.ng/articles/markiq-si-launches-in-abeokuta-with-a-trading-academy-and-a-bot-builder',
    },
  ] as { title: string; outlet: string; publisher: string; author: string; date: string; url: string }[],
};
