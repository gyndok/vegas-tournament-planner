'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useTheme } from '@/components/theme-provider'
import { ExternalLink, Newspaper } from 'lucide-react'

const TWITTER_LIST_URL = 'https://x.com/i/lists/2027789342102450505'

const POKER_ROOMS = [
  { name: 'WSOP', handle: 'WSOP' },
  { name: 'Wynn', handle: 'WynnPoker' },
  { name: 'Resorts World', handle: 'RWLV_Poker' },
  { name: 'Aria', handle: 'AriaPoker' },
  { name: 'Venetian', handle: 'VenetianPoker' },
  { name: 'Golden Nugget', handle: 'GNPokerRoom' },
  { name: 'Orleans', handle: 'OrleansPoker' },
  { name: 'South Point', handle: 'southpointpoker' },
  { name: 'PokerGO', handle: 'PokerGO' },
]

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void
      }
    }
  }
}

export default function NewsPage() {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)

  const renderTimeline = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous embed
    container.innerHTML = ''

    // Create timeline anchor
    const anchor = document.createElement('a')
    anchor.className = 'twitter-timeline'
    anchor.setAttribute('data-theme', theme)
    anchor.setAttribute('data-chrome', 'noheader nofooter noborders')
    anchor.setAttribute('data-height', '800')
    anchor.setAttribute('href', TWITTER_LIST_URL)
    anchor.textContent = 'Loading tweets...'
    container.appendChild(anchor)

    // Tell Twitter to render
    if (window.twttr?.widgets) {
      window.twttr.widgets.load(container)
    }
  }, [theme])

  // Load Twitter widget script
  useEffect(() => {
    if (scriptLoadedRef.current) {
      renderTimeline()
      return
    }

    // Check if script already exists
    if (document.getElementById('twitter-wjs')) {
      scriptLoadedRef.current = true
      renderTimeline()
      return
    }

    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      renderTimeline()
    }
    document.body.appendChild(script)
  }, [renderTimeline])

  // Re-render when theme changes
  useEffect(() => {
    if (scriptLoadedRef.current) {
      renderTimeline()
    }
  }, [theme, renderTimeline])

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Poker Room News</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live updates from Las Vegas poker rooms on X/Twitter
        </p>
      </div>

      {/* Venue chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {POKER_ROOMS.map((room) => (
          <a
            key={room.handle}
            href={`https://x.com/${room.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {room.name}
            <ExternalLink className="size-3 opacity-50" />
          </a>
        ))}
      </div>

      {/* Twitter List embed */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div ref={containerRef} className="min-h-[400px]">
          {/* Placeholder while loading */}
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Newspaper className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Loading feed...</p>
          </div>
        </div>
      </div>

      {/* Fallback link */}
      <p className="text-center text-xs text-muted-foreground">
        Feed not loading?{' '}
        <a
          href={TWITTER_LIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          View on X/Twitter
        </a>
      </p>
    </div>
  )
}
