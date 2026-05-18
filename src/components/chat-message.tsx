'use client'

import { ChatMessage as ChatMessageType } from '@/types'
import { formatBuyIn, formatTime, formatDate, getSeriesColor } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Bot, User } from 'lucide-react'
import Link from 'next/link'

interface ChatMessageProps {
  message: ChatMessageType
}

function formatMessageText(text: string) {
  // Split by newlines, then handle **bold** markers within each line
  return text.split('\n').map((line, lineIdx) => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let keyIdx = 0

    while (remaining.length > 0) {
      const boldStart = remaining.indexOf('**')
      if (boldStart === -1) {
        parts.push(remaining)
        break
      }

      // Add text before the bold marker
      if (boldStart > 0) {
        parts.push(remaining.slice(0, boldStart))
      }

      const boldEnd = remaining.indexOf('**', boldStart + 2)
      if (boldEnd === -1) {
        // No closing **, just add the rest as-is
        parts.push(remaining.slice(boldStart))
        break
      }

      parts.push(
        <strong key={`b-${lineIdx}-${keyIdx++}`}>
          {remaining.slice(boldStart + 2, boldEnd)}
        </strong>
      )
      remaining = remaining.slice(boldEnd + 2)
    }

    return (
      <span key={`line-${lineIdx}`}>
        {lineIdx > 0 && <br />}
        {parts}
      </span>
    )
  })
}

function TournamentMiniCard({ tournament }: { tournament: ChatMessageType['tournaments'] extends (infer T)[] | undefined ? T : never }) {
  if (!tournament) return null
  const seriesName = tournament.series?.name || ''
  const seriesColor = getSeriesColor(seriesName, tournament.series?.venue, tournament.name)

  return (
    <Link
      href={`/tournament/${tournament.slug ?? tournament.id}`}
      className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${seriesColor.bg} ${seriesColor.text}`}
        >
          {seriesColor.label}
        </span>
        <span className="text-sm font-bold">{formatBuyIn(tournament.buy_in)}</span>
      </div>
      <p className="text-xs font-medium leading-snug line-clamp-1 mb-1">{tournament.name}</p>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{formatDate(tournament.date)}</span>
        <span className="text-border">|</span>
        <span>{formatTime(tournament.start_time)}</span>
        <span className="text-border">|</span>
        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-auto">
          {tournament.game_type}
        </Badge>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-auto">
          {tournament.format}
        </Badge>
      </div>
    </Link>
  )
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary/20' : 'bg-primary/20'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-primary/10 text-foreground rounded-tr-sm'
              : 'bg-card border border-border text-foreground rounded-tl-sm'
          }`}
        >
          {formatMessageText(message.content)}
        </div>

        {/* Tournament cards (assistant only) */}
        {!isUser && message.tournaments && message.tournaments.length > 0 && (
          <div className="w-full grid gap-2">
            {message.tournaments.slice(0, 10).map((tournament) => (
              <TournamentMiniCard key={tournament.id} tournament={tournament} />
            ))}
            {message.tournaments.length > 10 && (
              <p className="text-xs text-muted-foreground px-1">
                ...and {message.tournaments.length - 10} more tournaments
              </p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}
