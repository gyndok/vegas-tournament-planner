import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  anthropic,
  CHAT_MODEL,
  buildSystemPrompt,
  TOOL_DEFINITIONS,
  computeUsageCost,
} from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildTournamentQuery } from '@/lib/queries'
import { Tournament } from '@/types'
import { checkChatRateLimit } from '@/lib/rate-limit'

// Cost protection constants
const MAX_HISTORY_MESSAGES = 10 // Only send last 10 messages (5 turns) to Claude
const MAX_INPUT_LENGTH = 1000 // Max characters per user message
const TOOL_RESULT_ROW_CAP = 10 // Cap tournaments returned to the model per tool call
const DEFAULT_DAILY_COST_CAP_USD = 50

function getDailyCostCap(): number {
  const raw = process.env.CHAT_DAILY_COST_CAP_USD
  if (!raw) return DEFAULT_DAILY_COST_CAP_USD
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_COST_CAP_USD
}

export async function POST(request: NextRequest) {
  try {
    // --- Rate limiting (per IP, in-memory) ---
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateCheck = checkChatRateLimit(ip)

    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.resetInSeconds / 60)
      return NextResponse.json(
        {
          content: `You've hit the message limit (20/hour). Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          tournaments: [],
        },
        { status: 429 }
      )
    }

    const { messages } = await request.json()

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-api-key') {
      return NextResponse.json(
        {
          content: 'The AI chat feature requires an Anthropic API key. Please configure ANTHROPIC_API_KEY in your environment.',
          tournaments: [],
        },
        { status: 200 }
      )
    }

    // --- Input length cap ---
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.content && lastMessage.content.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        {
          content: `Please keep your message under ${MAX_INPUT_LENGTH} characters. Try being more specific about what you're looking for.`,
          tournaments: [],
        },
        { status: 200 }
      )
    }

    // --- Daily cost cap (site-wide). Refuse new chats once today's spend is
    // over the cap. The cap is checked once at the start of the request, then
    // usage is logged after. A single in-flight request can push us slightly
    // over the cap — that's acceptable; the cap is a soft guard, not a hard
    // billing limit.
    const svc = createAdminClient()
    const dailyCap = getDailyCostCap()
    const today = new Date().toISOString().slice(0, 10)
    const { data: usageRow } = await svc
      .from('chat_usage')
      .select('cost_usd')
      .eq('date', today)
      .maybeSingle()
    const spentToday = Number(usageRow?.cost_usd ?? 0)
    if (spentToday >= dailyCap) {
      return NextResponse.json(
        {
          content:
            'The AI Advisor is paused for the rest of today — it hit its daily usage limit. Resets at midnight Pacific. You can still browse the schedule, build your trip, and run Last Longer Pools while it\'s offline.',
          tournaments: [],
        },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const systemPrompt = buildSystemPrompt(currentTime)

    // --- History trimming ---
    // Only send the last N messages to keep token costs predictable
    const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES)

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.Messages.MessageParam[] = trimmedMessages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    let allTournaments: Tournament[] = []
    let currentMessages = [...anthropicMessages]

    // Accumulators for usage across the tool-use loop. We log a single row to
    // chat_usage after the loop completes (success or out-of-rounds).
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheCreation = 0
    let totalCacheRead = 0

    function recordUsage() {
      const cost = computeUsageCost({
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cache_creation_input_tokens: totalCacheCreation,
        cache_read_input_tokens: totalCacheRead,
      })
      // Fire-and-forget. We don't want logging failures to break the chat.
      svc
        .rpc('record_chat_usage', {
          p_input_tokens: totalInputTokens,
          p_output_tokens: totalOutputTokens,
          p_cache_creation: totalCacheCreation,
          p_cache_read: totalCacheRead,
          p_cost_usd: cost,
        })
        .then(({ error }) => {
          if (error) console.error('[chat] record_chat_usage failed', error.message)
        })
    }

    // System prompt in array form so we can attach cache_control. With the
    // last tool also marked cache_control: ephemeral (see TOOL_DEFINITIONS),
    // both the system and the tools land in the same prompt cache breakpoint.
    const cachedSystem: Anthropic.Messages.TextBlockParam[] = [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ]

    // Tool-use loop (max 5 rounds)
    for (let round = 0; round < 5; round++) {
      const response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 1500,
        system: cachedSystem,
        tools: TOOL_DEFINITIONS,
        messages: currentMessages,
      })

      // Accumulate usage from this API call.
      const u = response.usage
      totalInputTokens += u.input_tokens ?? 0
      totalOutputTokens += u.output_tokens ?? 0
      totalCacheCreation += u.cache_creation_input_tokens ?? 0
      totalCacheRead += u.cache_read_input_tokens ?? 0

      // If no tool use, extract text and return
      if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
        const textContent = response.content
          .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('')

        recordUsage()
        return NextResponse.json({ content: textContent, tournaments: allTournaments })
      }

      // Handle tool calls
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
      )
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        if (toolUse.name === 'search_tournaments') {
          const input = toolUse.input as Record<string, unknown>
          // Cap the per-call row count. The model can ask for more, but we
          // never let it exceed TOOL_RESULT_ROW_CAP to keep tool-result tokens
          // (and therefore the next API call's input cost) bounded.
          const requested = (input.limit as number) || TOOL_RESULT_ROW_CAP
          const effectiveLimit = Math.min(requested, TOOL_RESULT_ROW_CAP)
          const { data, error } = await buildTournamentQuery(supabase, {
            dateFrom: input.date_from as string | undefined,
            dateTo: input.date_to as string | undefined,
            buyInMin: input.buy_in_min as number | undefined,
            buyInMax: input.buy_in_max as number | undefined,
            gameTypes: input.game_types as string[] | undefined,
            formats: input.formats as string[] | undefined,
            startTimeFrom: input.start_time_from as string | undefined,
            startTimeTo: input.start_time_to as string | undefined,
            sortBy: input.sort_by as 'date' | 'buy_in_asc' | 'buy_in_desc' | 'guarantee_desc' | undefined,
            limit: effectiveLimit,
          })

          if (error) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: ${error.message}`,
            })
          } else {
            const tournaments = (data as Tournament[]) || []
            allTournaments = [...allTournaments, ...tournaments]
            // Trim to the smallest field set Claude actually needs to format
            // an answer — name/date/time/buy_in/format are core; we keep
            // structure fields so it can answer "deep stack?" / "long blinds?"
            // and surface the venue (the whole series object isn't needed).
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(
                tournaments.map((t) => ({
                  id: t.id,
                  name: t.name,
                  date: t.date,
                  start_time: t.start_time,
                  buy_in: t.buy_in,
                  game_type: t.game_type,
                  format: t.format,
                  is_flight: t.is_flight,
                  flight_label: t.flight_label,
                  guaranteed_prize: t.guaranteed_prize,
                  starting_stack: t.starting_stack,
                  blind_levels_minutes: t.blind_levels_minutes,
                  late_reg_end_time: t.late_reg_end_time,
                  series: t.series
                    ? { name: t.series.name, venue: t.series.venue }
                    : null,
                }))
              ),
            })
          }
        } else if (toolUse.name === 'get_current_time') {
          const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: now,
          })
        }
      }

      // Add assistant message and tool results to conversation
      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    recordUsage()
    return NextResponse.json({
      content: 'I had trouble processing that request. Please try again.',
      tournaments: [],
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { content: 'Something went wrong. Please try again.', tournaments: [] },
      { status: 500 }
    )
  }
}
