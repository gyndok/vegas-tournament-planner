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
 * Search the web for a casino's tournament schedule and scrape the best
 * result. Uses Firecrawl's search endpoint to find URLs, then scrapes
 * the top hit for markdown content.
 *
 * This is a fallback when hardcoded URLs fail (page moved, slug changed, etc).
 */
export async function searchAndScrape(
  seriesName: string,
  venue: string
): Promise<string> {
  const app = getFirecrawlApp()

  // Try PokerAtlas-specific search first
  const query = `${seriesName} ${venue} poker tournament schedule site:pokeratlas.com`
  const results = await app.search(query, { limit: 3 })

  const hits = results.web || []

  for (const hit of hits) {
    const url = 'url' in hit ? hit.url : undefined
    if (url) {
      const markdown = await scrapeToMarkdown(url)
      if (markdown.length > 200) return markdown
    }
  }

  // If PokerAtlas search returned nothing useful, try a broader search
  const broadQuery = `${seriesName} ${venue} tournament schedule`
  const broadResults = await app.search(broadQuery, { limit: 3 })

  const broadHits = broadResults.web || []
  for (const hit of broadHits) {
    const url = 'url' in hit ? hit.url : undefined
    if (url) {
      const markdown = await scrapeToMarkdown(url)
      if (markdown.length > 200) return markdown
    }
  }

  throw new Error(
    `Firecrawl search found no usable content for "${seriesName}" at "${venue}"`
  )
}
