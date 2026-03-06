import { CasinoConfig } from './types'

/**
 * Configuration for all 6 Las Vegas casino poker tournament series.
 * URLs are for the 2026 summer season — update slugs each year.
 *
 * NOTE: Some 2026 series pages exist on PokerAtlas but individual
 * tournament schedules won't be published until April/May 2026.
 * The scraper will return 0 results until then — that's expected.
 */
export const CASINO_CONFIGS: CasinoConfig[] = [
  {
    key: 'aria',
    seriesName: '2026 Aria Poker Classic',
    venue: 'Aria Resort & Casino',
    // URL TBD — PokerAtlas hasn't posted the 2026 summer series yet.
    // Using projected slug based on naming pattern. Update when live.
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2026-aria-poker-classic-aria-las-vegas-2026',
    startDate: '2026-05-27',
    endDate: '2026-07-12',
    websiteUrl:
      'https://www.pokeratlas.com/poker-room/aria-las-vegas/tournaments',
    colorKey: 'Aria',
  },
  {
    key: 'venetian',
    seriesName: '2026 Venetian DeepStack Championship',
    venue: 'The Venetian Resort',
    // URL TBD — summer DeepStack Championship not posted yet.
    // Using projected slug. Update when live.
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/deepstack-championship-2026-venetian-las-vegas-2026',
    fallbackUrl:
      'https://www.venetianlasvegas.com/resort/casino/poker/deepstack-extravaganza-poker-tournament.html',
    startDate: '2026-05-18',
    endDate: '2026-07-31',
    websiteUrl:
      'https://www.venetianlasvegas.com/resort/casino/poker/deepstack-extravaganza-poker-tournament.html',
    colorKey: 'Venetian',
  },
  {
    key: 'wynn',
    seriesName: '2026 Wynn Summer Classic',
    venue: 'Wynn Las Vegas',
    // URL TBD — summer classic not posted yet.
    // Using projected slug. Update when live.
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2026-wynn-summer-classic-wynn-las-vegas-2026',
    startDate: '2026-05-20',
    endDate: '2026-07-13',
    websiteUrl:
      'https://www.pokeratlas.com/poker-room/wynn-las-vegas/tournaments',
    colorKey: 'Wynn',
  },
  {
    key: 'goldennugget',
    seriesName: '2026 Golden Nugget Grand Poker Series',
    venue: 'Golden Nugget Las Vegas',
    // URL TBD — summer GPS not posted yet.
    // Using projected slug. Update when live.
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2026-grand-poker-series-golden-nugget-lv-las-vegas-2026',
    startDate: '2026-05-26',
    endDate: '2026-07-01',
    websiteUrl:
      'https://www.goldennugget.com/las-vegas/casino/poker-room/',
    colorKey: 'Golden Nugget',
  },
  {
    key: 'mgm',
    seriesName: '2026 MGM Grand Summer Poker Festival',
    venue: 'MGM Grand Las Vegas',
    // URL TBD — summer festival not posted yet.
    // Using projected slug. Update when live.
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/mgm-grand-summer-poker-festival-26-mgm-grand-las-vegas-2026',
    startDate: '2026-05-22',
    endDate: '2026-07-05',
    websiteUrl:
      'https://www.pokeratlas.com/poker-room/mgm-grand-las-vegas/tournaments',
    colorKey: 'MGM',
  },
  {
    key: 'orleans',
    seriesName: '2026 Orleans Summer Open',
    venue: 'The Orleans Hotel & Casino',
    pokerAtlasUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2026-orleans-summer-open-the-orleans-las-vegas-2026',
    startDate: '2026-05-22',
    endDate: '2026-07-12',
    websiteUrl:
      'https://www.pokeratlas.com/poker-tournament-series/2026-orleans-summer-open-the-orleans-las-vegas-2026',
    colorKey: 'Orleans',
  },
]

/** Get a casino config by its key */
export function getCasinoConfig(key: string): CasinoConfig | undefined {
  return CASINO_CONFIGS.find((c) => c.key === key)
}
