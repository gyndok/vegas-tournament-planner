import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CHAT_MODEL, buildSystemPrompt, TOOL_DEFINITIONS } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'
import { buildTournamentQuery } from '@/lib/queries'
import { Tournament } from '@/types'

export async function POST(request: NextRequest) {
  try {
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

    const supabase = await createClient()
    const currentTime = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const systemPrompt = buildSystemPrompt(currentTime)

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    )

    let allTournaments: Tournament[] = []
    let currentMessages = [...anthropicMessages]

    // Tool-use loop (max 5 rounds)
    for (let round = 0; round < 5; round++) {
      const response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages: currentMessages,
      })

      // If no tool use, extract text and return
      if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
        const textContent = response.content
          .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('')

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
            limit: (input.limit as number) || 20,
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
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(
                tournaments.map((t) => ({
                  id: t.id,
                  name: t.name,
                  date: t.date,
                  day_of_week: t.day_of_week,
                  start_time: t.start_time,
                  buy_in: t.buy_in,
                  game_type: t.game_type,
                  format: t.format,
                  table_size: t.table_size,
                  is_flight: t.is_flight,
                  flight_label: t.flight_label,
                  guaranteed_prize: t.guaranteed_prize,
                  starting_stack: t.starting_stack,
                  blind_levels_minutes: t.blind_levels_minutes,
                  late_reg_end_time: t.late_reg_end_time,
                  series: t.series,
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
