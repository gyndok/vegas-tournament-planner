'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/components/theme-provider'
import { ExternalLink, Newspaper } from 'lucide-react'

const TWITTER_LIST_URL = 'https://twitter.com/gyndok/lists/poker-in-vegas'
const TWITTER_LIST_FALLBACK_URL = 'https://x.com/i/lists/2027789342102450505'

const POKER_ROOMS = [
  { name: 'WSOP', handle: 'WSOP' },
  { name: 'Wynn', handle: 'WynnPoker' },
  { name: 'Resorts World', handle: 'gicpoker' },
  { name: 'Aria', handle: 'ARIAPoker' },
  { name: 'Venetian', handle: 'VenetianPoker' },
  { name: 'Golden Nugget', handle: 'GNLVpoker' },
  { name: 'Orleans', handle: 'OrleansPokerRo1' },
  { name: 'South Point', handle: 'southpointpoker' },
  { name: 'PokerGO', handle: 'PokerGO' },
]

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void
        createTimeline: (
          source: { sourceType: string; id?: string; url?: string },
          target: HTMLElement,
          options?: Record<string, unknown>
        ) => Promise<HTMLElement>
      }
    }
  }
}

export default function NewsPage() {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)
  const [embedFailed, setEmbedFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function renderTimeline() {
      if (!container) return

      // Clear previous embed
      container.innerHTML = ''
      setEmbedFailed(false)

      // Use anchor-tag approach — the officially documented method for list embeds
      const anchor = document.createElement('a')
      anchor.className = 'twitter-timeline'
      anchor.setAttribute('data-theme', theme)
      anchor.setAttribute('data-chrome', 'noheader nofooter noborders')
      anchor.setAttribute('data-height', '800')
      anchor.setAttribute('data-dnt', 'true')
      anchor.href = TWITTER_LIST_URL
      anchor.textContent = 'Tweets from Poker in Vegas'
      container.appendChild(anchor)

      if (window.twttr?.widgets) {
        window.twttr.widgets.load(container)
      }
    }

    // If script already loaded, render
    if (scriptLoadedRef.current) {
      renderTimeline()
      return
    }

    // Check if script exists
    if (document.getElementById('twitter-wjs')) {
      scriptLoadedRef.current = true
      if (window.twttr?.widgets) {
        renderTimeline()
      } else {
        const check = setInterval(() => {
          if (window.twttr?.widgets) {
            clearInterval(check)
            scriptLoadedRef.current = true
            renderTimeline()
          }
        }, 200)
        setTimeout(() => {
          clearInterval(check)
          setEmbedFailed(true)
        }, 10000)
      }
      return
    }

    // Load Twitter widget script
    const script = document.createElement('script')
    script.id = 'twitter-wjs'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      setTimeout(renderTimeline, 100)
    }
    script.onerror = () => {
      setEmbedFailed(true)
    }
    document.body.appendChild(script)
  }, [theme])

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
          {!embedFailed && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Newspaper className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Loading feed...</p>
            </div>
          )}
        </div>

        {embedFailed && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Newspaper className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium mb-1">Unable to load feed</p>
            <p className="text-xs text-muted-foreground mb-4">
              This may be caused by an ad blocker or network issue.
            </p>
            <a
              href={TWITTER_LIST_FALLBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              View on X/Twitter
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Fallback link */}
      <p className="text-center text-xs text-muted-foreground">
        Feed not loading?{' '}
        <a
          href={TWITTER_LIST_FALLBACK_URL}
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
