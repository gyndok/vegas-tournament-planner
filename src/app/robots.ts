import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/settings',
          '/chat',
          '/trip',
          '/schedule',
          '/custom',
          '/pro',
          '/pools',
          '/feedback',
          // /shared is intentionally crawlable so X/Discord/etc. can fetch
          // the OG card; the page itself sets robots: noindex, follow=false.
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
