/**
 * SEO constants and JSON-LD builders. Anything that ends up in <head> as
 * structured data should be created here so the shapes stay consistent
 * across pages and are easy to audit with Google's Rich Results tool.
 */

export const SITE_URL = 'https://nextrebuy.com'
export const SITE_NAME = 'NextRebuy'
export const SITE_TWITTER = '@gyndok'

/**
 * Organization schema — emitted once on the landing page so Google knows
 * what the site/brand is and which logo to associate with it.
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo-square.png`,
    sameAs: [
      'https://x.com/gyndok',
      'https://pokerdb.thehendonmob.com/player.php?a=r&n=26705',
    ],
  }
}

/**
 * WebSite schema with SearchAction so Google can render a sitelinks
 * search box under our SERP entry. The target URL points at /browse
 * with a search query parameter.
 */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/browse?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

interface EventJsonLdInput {
  id: string
  name: string
  date: string // YYYY-MM-DD
  start_time: string // HH:MM (24h)
  buy_in: number | null
  guaranteed_prize: number | null
  series?: { name?: string | null; venue?: string | null } | null
}

/**
 * Event schema for a single poker tournament. Maps the venue → location,
 * the series → organizer, and buy-in → offers.price. We mark the event
 * as scheduled by default; cancellations/rescheduling aren't currently
 * surfaced via the tournament schema, so we don't fabricate an
 * eventStatus we can't trust.
 */
export function tournamentEventJsonLd(t: EventJsonLdInput) {
  const startDateIso = `${t.date}T${(t.start_time || '00:00').slice(0, 5)}:00-08:00`
  const venue = t.series?.venue?.trim() || 'Las Vegas'
  const seriesName = t.series?.name?.trim() || SITE_NAME

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: t.name,
    startDate: startDateIso,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: venue,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Las Vegas',
        addressRegion: 'NV',
        addressCountry: 'US',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: seriesName,
    },
    url: `${SITE_URL}/tournament/${t.id}`,
    ...(t.buy_in != null && {
      offers: {
        '@type': 'Offer',
        price: t.buy_in,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/tournament/${t.id}`,
      },
    }),
    ...(t.guaranteed_prize != null && {
      description: `Buy-in $${t.buy_in?.toLocaleString() ?? '—'}. Guaranteed prize pool $${t.guaranteed_prize.toLocaleString()}.`,
    }),
  }
}

interface FaqItem {
  question: string
  answer: string
}

/**
 * FAQPage schema. Pass a flat list of Q/A; section grouping is purely
 * visual and isn't part of the schema.
 */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
