import { CasinoConfig } from './types'

/**
 * Configuration for all 6 Las Vegas casino poker tournament series.
 * URLs are for the 2025 summer season — update slugs each year.
 */
export const CASINO_CONFIGS: CasinoConfig[] = [
  {
    key: 'aria',
    seriesName: '2025 Aria Poker Classic',
    venue: 'Aria Resort & Casino',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-aria-poker-classic-aria-las-vegas-2025',
    startDate: '2025-05-28',
    endDate: '2025-07-13',
    websiteUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-aria-poker-classic-aria-las-vegas-2025',
    colorKey: 'Aria',
  },
  {
    key: 'venetian',
    seriesName: '2025 Venetian DeepStack Championship',
    venue: 'The Venetian Resort',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/deepstack-championship-2025-venetian-las-vegas-2025',
    fallbackUrl:
      'https://www.venetianlasvegas.com/resort/casino/poker/deepstack-extravaganza-poker-tournament/dscps-2025.html',
    startDate: '2025-05-19',
    endDate: '2025-07-31',
    websiteUrl:
      'https://www.venetianlasvegas.com/resort/casino/poker/deepstack-extravaganza-poker-tournament.html',
    colorKey: 'Venetian',
  },
  {
    key: 'wynn',
    seriesName: '2025 Wynn Summer Classic',
    venue: 'Wynn Las Vegas',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-wynn-summer-classic-wynn-las-vegas-2025',
    startDate: '2025-05-21',
    endDate: '2025-07-14',
    websiteUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-wynn-summer-classic-wynn-las-vegas-2025',
    colorKey: 'Wynn',
  },
  {
    key: 'goldennugget',
    seriesName: '2025 Golden Nugget Grand Poker Series',
    venue: 'Golden Nugget Las Vegas',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-grand-poker-series-golden-nugget-lv-las-vegas-2025',
    startDate: '2025-05-27',
    endDate: '2025-07-02',
    websiteUrl:
      'https://www.goldennugget.com/las-vegas/casino/poker-room/',
    colorKey: 'Golden Nugget',
  },
  {
    key: 'mgm',
    seriesName: '2025 MGM Grand Summer Poker Festival',
    venue: 'MGM Grand Las Vegas',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/mgm-grand-summer-poker-festival-25-mgm-grand-las-vegas-2025',
    startDate: '2025-05-23',
    endDate: '2025-07-06',
    websiteUrl:
      'https://www.pokeratlas.com/poker-tournament-series/mgm-grand-summer-poker-festival-25-mgm-grand-las-vegas-2025',
    colorKey: 'MGM',
  },
  {
    key: 'orleans',
    seriesName: '2025 Orleans Summer Open',
    venue: 'The Orleans Hotel & Casino',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-orleans-summer-open-the-orleans-las-vegas-2025',
    startDate: '2025-05-23',
    endDate: '2025-07-13',
    websiteUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2025-orleans-summer-open-the-orleans-las-vegas-2025',
    colorKey: 'Orleans',
  },
]

/** Get a casino config by its key */
export function getCasinoConfig(key: string): CasinoConfig | undefined {
  return CASINO_CONFIGS.find((c) => c.key === key)
}
