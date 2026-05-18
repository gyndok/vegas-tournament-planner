import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_URL } from '@/lib/seo'

/**
 * Dynamic sitemap: static public routes + every tournament. We use the
 * service-role client so RLS doesn't filter rows. Tournaments are the
 * bulk of the URLs and the highest-value pages for SEO — each one
 * becomes a unique landing page after the per-tournament metadata work.
 *
 * Cache long enough that Googlebot pulls a fresh copy each day but we
 * don't pay for it on every crawl.
 */
export const revalidate = 3600 // 1 hour

const staticRoutes: MetadataRoute.Sitemap = [
  { url: '/', changeFrequency: 'daily', priority: 1.0 },
  { url: '/browse', changeFrequency: 'daily', priority: 0.9 },
  { url: '/faq', changeFrequency: 'monthly', priority: 0.6 },
  { url: '/news', changeFrequency: 'weekly', priority: 0.5 },
  { url: '/login', changeFrequency: 'yearly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const staticEntries = staticRoutes.map((route) => ({
    ...route,
    url: `${SITE_URL}${route.url}`,
    lastModified,
  }))

  try {
    const svc = createAdminClient()
    const { data: tournaments } = await svc
      .from('tournaments')
      .select('id, date')
      .gte('date', new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10))
      .order('date', { ascending: true })

    const tournamentEntries: MetadataRoute.Sitemap = (tournaments ?? []).map(
      (t) => ({
        url: `${SITE_URL}/tournament/${t.id}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })
    )

    return [...staticEntries, ...tournamentEntries]
  } catch (err) {
    console.error('[sitemap] tournament fetch failed', err)
    return staticEntries
  }
}
