import { COURSES } from '@/lib/content/courses';
import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** Tells search engines which pages exist. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, '');
  const pages: [string, number][] = [['', 1], ['/markets', 0.9], ['/markets/terminal', 0.8], ['/markets/calendar', 0.8], ['/markets/replay', 0.7], ['/markets/news-flow', 0.8], ['/markets/strength', 0.8], ['/markets/cot', 0.7], ['/tools', 0.9], ['/fundamental-analysis', 0.9], ['/bot-builder', 0.9], ['/indicator-builder', 0.9], ['/market-scanner', 0.9], ['/prop-firm-tools', 0.9], ['/academy', 0.9], ['/courses', 0.9], ['/about', 0.7], ['/company', 0.7], ['/get-started', 0.7], ['/faqs', 0.6], ['/terms', 0.3], ['/privacy', 0.3]];
  const courses: [string, number][] = COURSES.map((c) => [`/courses/${c.slug}`, 0.8]);
  return [...pages, ...courses].map(([p, priority]) => ({ url: `${base}${p}`, lastModified: new Date(), changeFrequency: p.startsWith('/markets') ? 'hourly' : 'weekly', priority }));
}
