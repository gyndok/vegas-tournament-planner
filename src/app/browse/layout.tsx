import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Browse Vegas Poker Tournaments',
  description:
    'Browse every upcoming poker tournament in Las Vegas across WSOP, Wynn, Aria, Venetian, Resorts World, Horseshoe, South Point, and more. Filter by buy-in, game type (NLH, PLO, mixed), format, structure, and date.',
  alternates: { canonical: '/browse' },
  openGraph: {
    title: 'Browse Vegas Poker Tournaments',
    description:
      'Every Vegas tournament in one searchable list — filter by buy-in, game, format, structure, and date.',
    url: '/browse',
  },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children
}
