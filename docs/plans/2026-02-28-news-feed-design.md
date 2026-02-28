# News Feed — Vegas Poker Room Twitter/X Feed

**Date:** 2026-02-28

## Overview

Add a "News" page that embeds a chronological Twitter/X timeline from a curated list of Las Vegas poker room accounts. Uses Twitter's free embed widget — no API key, no backend, no cost.

## Data Source

**Twitter List:** https://x.com/i/lists/2027789342102450505 ("Poker in Vegas")

**Accounts in list:**
- @WSOP
- @WynnPoker
- @RWLV_Poker
- @AriaPoker
- @VenetianPoker
- @GNPokerRoom
- @OrleansPoker
- @southpointpoker
- @PokerGO

## Architecture

### Approach: Hybrid — List Embed + Venue Quick Links

**Venue chips row** — Horizontal scrollable row of 9 poker room badges at the top. Each badge shows the venue name and links to that account's X profile (opens in new tab). Hardcoded array, no database.

**Twitter List embed** — Single `<a class="twitter-timeline">` tag pointing to the list URL. Twitter's `widgets.js` script converts it into a full interactive timeline iframe. Passes `data-theme` to match app light/dark mode, `data-chrome="noheader nofooter"` for clean appearance.

### Page Location

- **Route:** `/news`
- **Navigation:** New "News" item in left sidebar (between "AI Advisor" and "Settings"), using `Newspaper` icon from lucide-react
- **Not in mobile bottom nav** — accessible via sidebar only

### Technical Details

- **Client component** (`'use client'`) — needs `useEffect` to load Twitter widget script and `useTheme` for dark/light sync
- **Script loading:** Dynamically inject Twitter's `widgets.js` on mount, call `twttr.widgets.load()` to render the timeline
- **Theme sync:** When theme changes, re-render the embed by clearing and re-creating the timeline anchor element, then calling `twttr.widgets.load()` again
- **Loading state:** Show skeleton/spinner while Twitter widget loads
- **Error state:** If widget fails to load (ad blocker, network), show fallback message with direct link to the list on X

### Venue Chips Data

```typescript
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
```

## Files to Create/Modify

1. `src/app/news/page.tsx` — New page with venue chips + Twitter List embed
2. `src/components/left-sidebar.tsx` — Add "News" nav item
3. No database changes, no API routes, no new dependencies

## Cost

$0 — Twitter embeds are free. No API key needed.
