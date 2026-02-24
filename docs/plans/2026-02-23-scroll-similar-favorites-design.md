# Design: Infinite Scroll, Similar Tournaments & Favorites

> **Date:** 2026-02-23
> **Status:** Approved
> **Features:** #4 Infinite Scroll & Performance, #5 Similar Tournaments, #6 Favorites / Watchlist

---

## Feature #4: Infinite Scroll & Performance

### Problem
The browse page hard-caps at 50 results. Users can't see the full tournament list without pagination.

### Approach
- **Cursor-based pagination** in the tournaments API using `(date, start_time, id)` as the cursor
- **Intersection Observer** on a sentinel element near the bottom of the list
- **React Query `useInfiniteQuery`** pattern for client-side page management
- Skeleton loading states while new pages load
- "Showing X of Y" counter with total count from a lightweight `COUNT(*)` query

### API Changes
- Add `cursor` and `limit` (default 30) query params to `GET /api/tournaments`
- Response shape: `{ data: Tournament[], nextCursor: string | null, totalCount: number }`
- Cursor is a base64-encoded `date|start_time|id` string for stable pagination

### Client Changes
- New `useInfiniteQuery`-style hook (`useTournaments`) replacing current `useEffect` fetch
- Intersection Observer on a sentinel `<div>` after the last card
- Skeleton cards (3-4) shown while loading next page
- "Showing X of Y tournaments" text above the list

### What We're NOT Doing
- Virtual scrolling (unnecessary at these data sizes)
- "Load more" button (Intersection Observer is smoother)

---

## Feature #5: Similar Tournaments

### Problem
When viewing a tournament detail page, users have no easy way to discover alternatives on the same day with a similar buy-in or game type.

### Approach
- **Server-side query** on the detail page: find tournaments matching 2+ attributes of the current one (same day, similar buy-in within +/-30%, same game type)
- **"Similar Tournaments" section** at the bottom of the detail page
- Horizontal scrollable row of tournament cards (reuse `TournamentCard`)
- Max 6 results, ordered by number of matching attributes

### API Changes
- New `GET /api/tournaments/[id]/similar` endpoint
- Accepts the tournament ID, queries for matches on date, buy-in range, game type
- Returns up to 6 tournaments excluding the current one

### Client Changes
- New section on `src/app/tournament/[id]/page.tsx`
- Horizontal scroll container with `TournamentCard` components
- "Similar Tournaments" heading with match count

### What We're NOT Doing (Yet)
- Side-by-side comparison modal (future enhancement)
- "Compare" checkbox feature (adds complexity, defer)

---

## Feature #6: Favorites / Watchlist

### Problem
Users currently can only "Add to Schedule" (with priority), but sometimes they want a lower-friction "I'm interested" action without committing.

### Approach
- **Heart icon toggle** on tournament cards (browse page, detail page, similar tournaments)
- **New `user_favorites` table** in Supabase: `user_id`, `tournament_id`, `created_at`
- **"Favorites" tab** on the schedule page alongside existing calendar views
- **One-click promote**: move a favorite to the schedule
- RLS policy: users can only see/manage their own favorites

### Database Schema
```sql
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  tournament_id UUID REFERENCES tournaments NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);

-- RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites"
  ON user_favorites FOR ALL
  USING (auth.uid() = user_id);
```

### API Changes
- `POST /api/favorites` — toggle favorite (add if not exists, remove if exists)
- `GET /api/favorites` — list user's favorites with joined tournament data

### Client Changes
- `FavoriteButton` component (heart icon, optimistic toggle)
- `useFavorites` hook for fetching and managing favorites state
- Added to `TournamentCard`, detail page, and similar tournaments section
- New "Favorites" tab on the schedule page showing favorited tournaments as cards
- "Add to Schedule" button on each favorited card for one-click promotion

### What We're NOT Doing
- Separate favorites page (tab on schedule is sufficient)
- Favorite categories or folders (over-engineering)

---

## Implementation Order

1. **Feature #4** first — Infinite Scroll (foundational, improves browse UX)
2. **Feature #5** second — Similar Tournaments (standalone, detail page addition)
3. **Feature #6** third — Favorites (cross-cutting, touches multiple pages)

Each feature gets its own branch, implementation plan, and PR.
