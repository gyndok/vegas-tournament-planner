import FirecrawlApp from '@mendable/firecrawl-js'

/**
 * Scrape a URL using Firecrawl and return the markdown content.
 * Uses `onlyMainContent: true` to strip navigation/footer/ads and
 * `waitFor: 3000` to allow PokerAtlas JS rendering.
 */
export async function scrapeToMarkdown(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY environment variable is not set. ' +
      'Get your API key from https://firecrawl.dev and add it to .env.local'
    )
  }

  const app = new FirecrawlApp({ apiKey })

  // The SDK's scrape() method returns a Document directly and throws on failure
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
