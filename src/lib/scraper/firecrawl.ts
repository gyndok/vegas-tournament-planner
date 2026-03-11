import FirecrawlApp from '@mendable/firecrawl-js'

function getFirecrawlApp(): FirecrawlApp {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY environment variable is not set. ' +
      'Get your API key from https://firecrawl.dev and add it to .env.local'
    )
  }
  return new FirecrawlApp({ apiKey })
}

/**
 * Scrape a URL using Firecrawl and return the markdown content.
 * Uses `onlyMainContent: true` to strip navigation/footer/ads and
 * `waitFor: 3000` to allow PokerAtlas JS rendering.
 */
export async function scrapeToMarkdown(url: string): Promise<string> {
  const app = getFirecrawlApp()

  const result = await app.scrape(url, {
    formats: ['markdown'],
    onlyMainContent: true,
    waitFor: 3000,
  })

  if (!result.markdown) {
    throw new Error(`Firecrawl returned no markdown content for ${url}`)
  }

  return result.markdown
}

/**
 * Search the web for a casino's tournament schedule and return the best
 * scraped markdown result. Uses Firecrawl's search endpoint which searches
 * AND scrapes results in one call — no extra round trips.
 *
 * This is a fallback when hardcoded URLs fail (page moved, slug changed, etc).
 */
export async function searchAndScrape(
  seriesName: string,
  venue: string
): Promise<string> {
  const app = getFirecrawlApp()

  const query = `${seriesName} ${venue} poker tournament schedule site:pokeratlas.com`

  const results = await app.search(query, { limit: 3 })

  // results.data contains search results with markdown content
  const hits = results.data || []

  // Find the best result that has substantial markdown content
  for (const hit of hits) {
    if (hit.markdown && hit.markdown.length > 200) {
      return hit.markdown
    }
  }

  // If PokerAtlas-specific search returned nothing useful, try a broader search
  const broadQuery = `${seriesName} ${venue} tournament schedule`
  const broadResults = await app.search(broadQuery, { limit: 3 })

  const broadHits = broadResults.data || []
  for (const hit of broadHits) {
    if (hit.markdown && hit.markdown.length > 200) {
      return hit.markdown
    }
  }

  throw new Error(
    `Firecrawl search found no usable content for "${seriesName}" at "${venue}"`
  )
}
