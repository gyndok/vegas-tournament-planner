import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const CHAT_MODEL = 'claude-sonnet-4-6'

/**
 * Per-token prices for the current CHAT_MODEL, in USD. Keep these in sync if
 * the model is ever swapped — they're used both for the daily cost gate and
 * for the admin Stats tab AI usage section.
 *
 * Source: Anthropic public pricing (per 1M tokens):
 *   Sonnet 4.6  input $3.00  output $15.00  cache write $3.75  cache read $0.30
 */
export const CHAT_PRICING = {
  inputPerToken: 3.0 / 1_000_000,
  outputPerToken: 15.0 / 1_000_000,
  cacheWritePerToken: 3.75 / 1_000_000,
  cacheReadPerToken: 0.3 / 1_000_000,
}

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export function computeUsageCost(usage: AnthropicUsage): number {
  return (
    (usage.input_tokens ?? 0) * CHAT_PRICING.inputPerToken +
    (usage.output_tokens ?? 0) * CHAT_PRICING.outputPerToken +
    (usage.cache_creation_input_tokens ?? 0) * CHAT_PRICING.cacheWritePerToken +
    (usage.cache_read_input_tokens ?? 0) * CHAT_PRICING.cacheReadPerToken
  )
}

export function buildSystemPrompt(currentTime: string, userPreferences?: Record<string, unknown> | null) {
  return `You are the Vegas Tournament Planner AI assistant. You help poker players find and plan tournaments across Las Vegas poker festivals.

Current date and time (PDT): ${currentTime}

You have access to a database of poker tournaments. Use the search_tournaments tool to find tournaments matching the user's criteria. When displaying results, be concise and highlight key details: event name, date/time, buy-in, game type, and format.

${userPreferences ? `
The user has saved these preferences:
- Buy-in range: $${userPreferences.buy_in_min || 0} - $${userPreferences.buy_in_max || 'any'}
- Preferred games: ${(userPreferences.preferred_games as string[])?.join(', ') || 'any'}
- Preferred formats: ${(userPreferences.preferred_formats as string[])?.join(', ') || 'any'}
- Avoids turbos: ${userPreferences.avoid_turbos ? 'yes' : 'no'}
- Trip dates: ${userPreferences.trip_start || 'not set'} to ${userPreferences.trip_end || 'not set'}

Use these as defaults when the user doesn't specify, but respect explicit overrides.
` : ''}

Guidelines:
- Be helpful, concise, and knowledgeable about poker tournament strategy
- When suggesting tournaments, consider time conflicts
- For late-reg queries, check current time against late_reg_end_time
- Format buy-ins with dollar signs and commas (e.g., "$1,500")
- Format times in 12-hour format (e.g., "2:00 PM")
- If no tournaments match, suggest alternatives or broadening criteria
- Present tournaments in a clear, organized way
- You can suggest multiple options for different preferences`
}

// The last tool carries a cache_control marker. With Anthropic prompt caching,
// the prefix up to and including the marked block is cached and re-read at 10%
// cost. Since system + tools sit before messages, this caches both. ~40% per-
// turn cost reduction once the cache is warm (5-minute TTL).
export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: 'search_tournaments',
    description: 'Search the tournament database with optional filters. Returns tournaments matching all specified criteria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        buy_in_min: { type: 'number', description: 'Minimum buy-in in dollars' },
        buy_in_max: { type: 'number', description: 'Maximum buy-in in dollars' },
        game_types: { type: 'array', items: { type: 'string' }, description: 'Game types: NLH, PLO, PLO8, Mixed, Stud, Razz, 2-7 Draw, Badugi, Big O, Limit Hold\'em, Stud8, 2-7 Triple Draw' },
        formats: { type: 'array', items: { type: 'string' }, description: 'Formats: Freezeout, Re-entry, Bounty, Mystery Bounty, Deepstack, Turbo' },
        start_time_from: { type: 'string', description: 'Earliest start time (HH:MM, 24h)' },
        start_time_to: { type: 'string', description: 'Latest start time (HH:MM, 24h)' },
        sort_by: { type: 'string', enum: ['date', 'buy_in_asc', 'buy_in_desc', 'guarantee_desc'] },
        limit: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_current_time',
    description: 'Get current date and time in PDT (Las Vegas time). Use for "what\'s available now" queries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    cache_control: { type: 'ephemeral' },
  },
]
