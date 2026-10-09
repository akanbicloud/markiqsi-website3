import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

const PRIVATE = ['/api/', '/account', '/welcome', '/auth/'];

/**
 * Search engines and AI assistants may read every public page (not accounts or the API).
 * AI crawlers are named so it is clear they are welcome: this is how MarkIQ SI shows up in ChatGPT, Claude, Perplexity, Gemini and Copilot answers.
 */
export default function robots(): MetadataRoute.Robots {
  const ai = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'Bingbot', 'CCBot', 'meta-externalagent', 'DuckAssistBot', 'YouBot'];
  return {
    rules: [{ userAgent: '*', allow: ['/', '/api/health'], disallow: PRIVATE }, ...ai.map((a) => ({ userAgent: a, allow: ['/', '/api/health'], disallow: PRIVATE }))],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
