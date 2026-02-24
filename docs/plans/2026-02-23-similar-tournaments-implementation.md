# Similar Tournaments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Similar Tournaments" section at the bottom of the tournament detail page, showing up to 6 tournaments that share attributes (same day, similar buy-in, same game type) with the current one.

**Architecture:** A server-side Supabase query on the detail page finds tournaments matching 2+ attributes. Results are rendered as a horizontal scrollable row of `TournamentCard` components. No new API route needed — the query runs directly in the server component.

**Tech Stack:** Next.js 16 server components, Supabase PostgREST, existing `TournamentCard` component

---

### Task 1: Create the similar tournaments query function

**Files:**
- Modify: `src/lib/queries.ts`

**Step 1: Add the similar tournaments query function**

Add this function at the bottom of `src/lib/queries.ts`:

```typescript
export async function getSimilarTournaments(
  supabase: SupabaseClient,
  tournament: {
    id: string
    date: string
    buy_in: number
    game_type: string
  },
  limit: number = 6
) {
  // Buy-in range: +/- 30%
  const buyInMin = Math.floor(tournament.buy_in * 0.7)
  const buyInMax = Math.ceil(tournament.buy_in * 1.3)

  // Find tournaments matching at least one criterion, ordered by relevance
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')
    .neq('id', tournament.id)
    .or(
      `date.eq.${tournament.date},` +
      `and(buy_in.gte.${buyInMin},buy_in.lte.${buyInMax}),` +
      `game_type.eq.${tournament.game_type}`
    )
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date')
    .order('start_time')
    .limit(limit * 3)  // Fetch extra to score and rank

  if (error || !data) return { data: [], error }

  // Score each by number of matching attributes
  const scored = data.map(t => {
    let score = 0
    if (t.date === tournament.date) score += 1
    if (t.buy_in >= buyInMin && t.buy_in <= buyInMax) score += 1
    if (t.game_type === tournament.game_type) score += 1
    return { ...t, _score: score }
  })

  // Sort by score descending, then by date
  scored.sort((a, b) => b._score - a._score || a.date.localeCompare(b.date))

  // Take top N, remove the score field
  const result = scored.slice(0, limit).map(({ _score, ...rest }) => rest)

  return { data: result, error: null }
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add getSimilarTournaments query function"
```

---

### Task 2: Create the SimilarTournaments component

**Files:**
- Create: `src/components/similar-tournaments.tsx`

**Step 1: Create the component**

This is a server component that fetches and renders similar tournaments:

```typescript
import { createClient } from '@/lib/supabase/server'
import { getSimilarTournaments } from '@/lib/queries'
import { TournamentCard } from '@/components/tournament-card'
import { Tournament } from '@/types'

interface SimilarTournamentsProps {
  tournament: {
    id: string
    date: string
    buy_in: number
    game_type: string
  }
}

export async function SimilarTournaments({ tournament }: SimilarTournamentsProps) {
  const supabase = await createClient()
  const { data: similar } = await getSimilarTournaments(supabase, tournament)

  if (!similar || similar.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Similar Tournaments</h2>
        <span className="text-sm text-muted-foreground">
          {similar.length} found
        </span>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {(similar as Tournament[]).map((t) => (
          <div key={t.id} className="min-w-[300px] max-w-[350px] snap-start shrink-0">
            <TournamentCard tournament={t} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/similar-tournaments.tsx
git commit -m "feat: add SimilarTournaments component"
```

---

### Task 3: Add SimilarTournaments to the detail page

**Files:**
- Modify: `src/app/tournament/[id]/page.tsx`

**Step 1: Import the component**

Add to the imports section:

```typescript
import { SimilarTournaments } from '@/components/similar-tournaments'
```

**Step 2: Add the component before the closing `</div>`**

After the `<AddToScheduleButton>` and before the final closing `</div>`, add:

```tsx
      {/* Similar Tournaments */}
      <SimilarTournaments
        tournament={{
          id: tournament.id,
          date: tournament.date,
          buy_in: tournament.buy_in,
          game_type: tournament.game_type,
        }}
      />
```

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/tournament/[id]/page.tsx
git commit -m "feat: add similar tournaments section to detail page"
```

---

### Task 4: Build verification

**Files:** None (testing only)

**Step 1: Full build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors
