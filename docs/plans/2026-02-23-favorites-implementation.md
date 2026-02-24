# Favorites / Watchlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Favorites" / Watchlist feature with a heart icon toggle on tournament cards. Users can favorite tournaments as a lightweight "interested but not committed" action, separate from adding to schedule.

**Architecture:** A `user_favorites` table in Supabase stores favorites with RLS. A `useFavorites` hook manages client-side state with optimistic updates. A `FavoriteButton` component (heart icon) is added to tournament cards. A "Favorites" tab on the schedule page shows favorited tournaments.

**Tech Stack:** Next.js 16 API routes, Supabase (RLS), React 19 hooks, Tailwind CSS, Lucide icons

---

### Task 1: Create the Supabase migration for user_favorites table

**Files:**
- Create: `supabase/migrations/20260223_create_user_favorites.sql`

**Step 1: Write the migration**

```sql
-- Create user_favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  tournament_id UUID REFERENCES tournaments NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tournament_id)
);

-- Enable RLS
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can only see their own favorites
CREATE POLICY "Users can view own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
  ON user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_user_tournament ON user_favorites(user_id, tournament_id);
```

**Step 2: Run the migration against the remote Supabase**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx supabase db push`

If `supabase` CLI is not set up, the migration can also be applied manually via the Supabase dashboard SQL editor. Either way, the migration file should be committed.

**Step 3: Commit**

```bash
git add supabase/migrations/20260223_create_user_favorites.sql
git commit -m "feat: add user_favorites table migration"
```

---

### Task 2: Create the favorites API route

**Files:**
- Create: `src/app/api/favorites/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/favorites — list user's favorites with tournament data
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('user_favorites')
    .select('id, tournament_id, created_at, tournament:tournament_id(*, series:series_id(id, name, venue))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST /api/favorites — toggle a favorite (add if not exists, remove if exists)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tournament_id } = await request.json()

  if (!tournament_id) {
    return NextResponse.json({ error: 'tournament_id is required' }, { status: 400 })
  }

  // Check if already favorited
  const { data: existing } = await supabase
    .from('user_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('tournament_id', tournament_id)
    .single()

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ favorited: false })
  } else {
    // Add favorite
    const { error } = await supabase
      .from('user_favorites')
      .insert({ user_id: user.id, tournament_id })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ favorited: true })
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/favorites/route.ts
git commit -m "feat: add favorites API route with toggle support"
```

---

### Task 3: Create the useFavorites hook

**Files:**
- Create: `src/hooks/use-favorites.ts`

**Step 1: Create the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

interface FavoriteEntry {
  id: string
  tournament_id: string
  created_at: string
  tournament?: any
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/favorites')
      if (res.status === 401) {
        setFavorites([])
        setLoading(false)
        return
      }
      if (!res.ok) {
        throw new Error('Failed to fetch favorites')
      }
      const data = await res.json()
      setFavorites(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch favorites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  const toggleFavorite = useCallback(
    async (tournamentId: string) => {
      // Optimistic update
      const isFavorited = favorites.some(f => f.tournament_id === tournamentId)

      if (isFavorited) {
        setFavorites(prev => prev.filter(f => f.tournament_id !== tournamentId))
      } else {
        setFavorites(prev => [
          { id: 'optimistic', tournament_id: tournamentId, created_at: new Date().toISOString() },
          ...prev,
        ])
      }

      try {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournament_id: tournamentId }),
        })
        if (!res.ok) throw new Error('Failed to toggle favorite')
        // Refetch to get accurate data
        await fetchFavorites()
      } catch {
        // Revert optimistic update on error
        await fetchFavorites()
      }
    },
    [favorites, fetchFavorites]
  )

  const isFavorited = useCallback(
    (tournamentId: string) => favorites.some(f => f.tournament_id === tournamentId),
    [favorites]
  )

  return {
    favorites,
    loading,
    error,
    toggleFavorite,
    isFavorited,
    refetch: fetchFavorites,
  }
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/hooks/use-favorites.ts
git commit -m "feat: add useFavorites hook with optimistic toggle"
```

---

### Task 4: Create the FavoriteButton component

**Files:**
- Create: `src/components/favorite-button.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useFavorites } from '@/hooks/use-favorites'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  tournamentId: string
  className?: string
}

export function FavoriteButton({ tournamentId, className }: FavoriteButtonProps) {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const { isFavorited, toggleFavorite, loading: favLoading } = useFavorites()

  const favorited = isFavorited(tournamentId)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    await toggleFavorite(tournamentId)
  }

  if (userLoading || (user && favLoading)) {
    return null
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 shrink-0 rounded-full transition-colors',
            favorited
              ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
              : 'text-muted-foreground hover:text-red-500 hover:bg-red-500/10',
            className,
          )}
          onClick={handleClick}
        >
          <Heart className={cn('size-4', favorited && 'fill-current')} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={4}>
        {!user
          ? 'Sign in to favorite'
          : favorited
            ? 'Remove from favorites'
            : 'Add to favorites'}
      </TooltipContent>
    </Tooltip>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/components/favorite-button.tsx
git commit -m "feat: add FavoriteButton component with heart icon"
```

---

### Task 5: Add FavoriteButton to TournamentCard

**Files:**
- Modify: `src/components/tournament-card.tsx`

**Step 1: Import FavoriteButton**

Add to imports:
```typescript
import { FavoriteButton } from '@/components/favorite-button'
```

**Step 2: Add FavoriteButton next to QuickAddButton**

In the top row where `QuickAddButton` is rendered, add `FavoriteButton` before it:

Find this section (around line 29-34):
```tsx
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                #{tournament.event_number}
              </span>
              <QuickAddButton tournamentId={tournament.id} />
            </div>
```

Replace with:
```tsx
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                #{tournament.event_number}
              </span>
              <FavoriteButton tournamentId={tournament.id} />
              <QuickAddButton tournamentId={tournament.id} />
            </div>
```

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/components/tournament-card.tsx
git commit -m "feat: add favorite heart button to tournament cards"
```

---

### Task 6: Add FavoriteButton to tournament detail page

**Files:**
- Modify: `src/app/tournament/[id]/page.tsx`

**Step 1: Import FavoriteButton**

The detail page is a server component, but `FavoriteButton` is a client component, so we can render it directly.

Add to imports:
```typescript
import { FavoriteButton } from '@/components/favorite-button'
```

**Step 2: Add FavoriteButton next to the series badge**

Find the series badge section (around lines 48-54):
```tsx
      <div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${seriesColor.bg} ${seriesColor.text}`}
        >
          {seriesColor.label} #{tournament.event_number}
        </span>
      </div>
```

Replace with:
```tsx
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${seriesColor.bg} ${seriesColor.text}`}
        >
          {seriesColor.label} #{tournament.event_number}
        </span>
        <FavoriteButton tournamentId={tournament.id} />
      </div>
```

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/app/tournament/[id]/page.tsx
git commit -m "feat: add favorite button to tournament detail page"
```

---

### Task 7: Add Favorites tab to schedule page

**Files:**
- Modify: `src/app/schedule/page.tsx`

**Step 1: Import useFavorites and add the favorites tab**

This is a substantial change. The schedule page needs a secondary tab set at the top: "Schedule" | "Favorites".

Add to imports:
```typescript
import { useFavorites } from '@/hooks/use-favorites'
import { TournamentCard } from '@/components/tournament-card'
import { Heart } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tournament } from '@/types'
```

**Step 2: Add state and favorites hook inside the component**

After the existing hooks, add:
```typescript
  const { favorites, loading: favLoading } = useFavorites()
```

Update loading to include favLoading:
```typescript
  const loading = userLoading || scheduleLoading || favLoading
```

**Step 3: Wrap the content in Tabs**

Replace the content after the header (the `<ScheduleCalendar>` section) with a tabbed layout:

The return statement's main content (after the header div with title and export button) should become:

```tsx
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarDays className="size-4" />
            Schedule
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground">({entries.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Heart className="size-4" />
            Favorites
            {favorites.length > 0 && (
              <span className="text-xs text-muted-foreground">({favorites.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleCalendar
            entries={entries}
            onUpdateEntry={updateEntry}
            onRemoveEntry={removeFromSchedule}
          />
        </TabsContent>

        <TabsContent value="favorites">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="size-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No favorites yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Tap the heart icon on any tournament to save it here.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/browse">Browse Tournaments</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((fav) => (
                fav.tournament && (
                  <TournamentCard
                    key={fav.id}
                    tournament={fav.tournament as Tournament}
                  />
                )
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
```

Also remove the count from the page title since it's now shown in the tab. Change:
```tsx
            <h1 className="text-2xl font-bold flex items-center gap-2">
              My Schedule
              {entries.length > 0 && (
                <span className="text-base font-normal text-muted-foreground">
                  ({entries.length} tournament{entries.length !== 1 ? 's' : ''})
                </span>
              )}
            </h1>
```
to:
```tsx
            <h1 className="text-2xl font-bold">My Schedule</h1>
```

**Step 4: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add src/app/schedule/page.tsx
git commit -m "feat: add favorites tab to schedule page"
```

---

### Task 8: Build verification

**Files:** None (testing only)

**Step 1: Full build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors
