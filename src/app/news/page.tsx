import { ExternalLink } from 'lucide-react'

const TWITTER_LIST_URL = 'https://x.com/i/lists/2027789342102450505'

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

export default function NewsPage() {
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

      {/* Link to Twitter List */}
      <a
        href={TWITTER_LIST_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-10 text-sm font-medium hover:bg-accent transition-colors"
      >
        View Poker in Vegas Feed on X/Twitter
        <ExternalLink className="size-4" />
      </a>
    </div>
  )
}
