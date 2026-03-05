# Late Entry Countdown Clocks — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add live countdown clocks showing time remaining for late registration on tournament cards, detail pages, and a new dashboard widget — plus populate the data via enhanced scraper and admin bulk editor.

**Architecture:** Client-side countdown hook calculates time remaining from `late_reg_end_time` (or computed from `start_time + blind_levels_minutes * late_reg_levels`). A shared `<LateRegBadge>` component renders color-coded countdown badges. Data is populated by enhancing the existing PokerAtlas scraper pipeline to extract `blind_levels_minutes`, `late_reg_levels`, and `starting_stack` from detail lines, with an admin bulk editor for manual gap-filling.

**Tech Stack:** Next.js App Router, React hooks (useState/useEffect), Supabase, Tailwind CSS, lucide-react icons. No new dependencies needed.

---

### Task 1: Create `useLateRegCountdown` Hook

**Files:**
- Create: `src/hooks/use-late-reg-countdown.ts`

**Context:** This hook is the core logic. It takes a tournament object, calculates when late registration ends, and returns a live-updating countdown. All times are Las Vegas time (America/Los_Angeles). The existing `src/components/pdt-clock.tsx` shows the project pattern for timezone-aware intervals.

**Step 1: Create the hook file**

```typescript
// src/hooks/use-late-reg-countdown.ts
'use client'

import { useState, useEffect, useMemo } from 'react'
import { Tournament } from '@/types'

export type LateRegStatus = 'not_started' | 'open' | 'closing' | 'urgent' | 'closed' | 'no_data'

interface LateRegCountdown {
  /** Time remaining in ms (0 if closed or no data) */
  timeRemainingMs: number
  /** Current status for styling */
  status: LateRegStatus
  /** Human-readable countdown: "3h 15m", "45m", "12m", etc. */
  formattedTime: string
  /** The calculated late reg end as a Date, or null */
  lateRegEndDate: Date | null
  /** Whether this countdown is for today and actively ticking */
  isLive: boolean
}

/**
 * Get current time in Las Vegas timezone as a Date object.
 */
function getNowInVegas(): Date {
  const now = new Date()
  const vegasStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  return new Date(vegasStr)
}

/**
 * Get today's date string (YYYY-MM-DD) in Las Vegas timezone.
 */
function getTodayInVegas(): string {
  const now = getNowInVegas()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculate the late registration end Date for a tournament.
 * Returns null if insufficient data.
 *
 * Priority:
 * 1. Use `late_reg_end_time` directly if set
 * 2. Calculate from `start_time + (blind_levels_minutes * late_reg_levels)`
 */
function calculateLateRegEnd(tournament: Tournament): Date | null {
  const tournamentDate = tournament.date // YYYY-MM-DD

  // Option 1: explicit late_reg_end_time
  if (tournament.late_reg_end_time) {
    // late_reg_end_time is HH:MM:SS format
    return new Date(`${tournamentDate}T${tournament.late_reg_end_time}`)
  }

  // Option 2: calculate from levels
  if (
    tournament.late_reg_levels &&
    tournament.blind_levels_minutes &&
    tournament.start_time
  ) {
    const startDate = new Date(`${tournamentDate}T${tournament.start_time}`)
    const lateRegMinutes = tournament.late_reg_levels * tournament.blind_levels_minutes
    return new Date(startDate.getTime() + lateRegMinutes * 60 * 1000)
  }

  return null
}

/**
 * Format milliseconds into a human-readable countdown string.
 */
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m'

  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  return `${minutes}m`
}

/**
 * Hook that provides a live countdown for a tournament's late registration.
 *
 * @param tournament - The tournament to track
 * @param intervalMs - Update interval (default 60000ms for lists, use 1000 for detail pages)
 */
export function useLateRegCountdown(
  tournament: Tournament,
  intervalMs: number = 60_000
): LateRegCountdown {
  const lateRegEnd = useMemo(() => calculateLateRegEnd(tournament), [
    tournament.date,
    tournament.start_time,
    tournament.late_reg_end_time,
    tournament.late_reg_levels,
    tournament.blind_levels_minutes,
  ])

  const isToday = tournament.date === getTodayInVegas()

  const [countdown, setCountdown] = useState<LateRegCountdown>(() =>
    computeCountdown(lateRegEnd, isToday)
  )

  useEffect(() => {
    // Recompute immediately when tournament changes
    setCountdown(computeCountdown(lateRegEnd, isToday))

    // Only set up interval for today's tournaments with data
    if (!lateRegEnd || !isToday) return

    const interval = setInterval(() => {
      setCountdown(computeCountdown(lateRegEnd, isToday))
    }, intervalMs)

    return () => clearInterval(interval)
  }, [lateRegEnd, isToday, intervalMs])

  return countdown
}

function computeCountdown(lateRegEnd: Date | null, isToday: boolean): LateRegCountdown {
  if (!lateRegEnd) {
    return {
      timeRemainingMs: 0,
      status: 'no_data',
      formattedTime: '',
      lateRegEndDate: null,
      isLive: false,
    }
  }

  if (!isToday) {
    return {
      timeRemainingMs: 0,
      status: 'not_started',
      formattedTime: '',
      lateRegEndDate: lateRegEnd,
      isLive: false,
    }
  }

  const now = getNowInVegas()
  const remaining = lateRegEnd.getTime() - now.getTime()

  if (remaining <= 0) {
    return {
      timeRemainingMs: 0,
      status: 'closed',
      formattedTime: '',
      lateRegEndDate: lateRegEnd,
      isLive: false,
    }
  }

  const fifteenMinutes = 15 * 60 * 1000
  const oneHour = 60 * 60 * 1000

  let status: LateRegStatus = 'open'
  if (remaining < fifteenMinutes) {
    status = 'urgent'
  } else if (remaining < oneHour) {
    status = 'closing'
  }

  return {
    timeRemainingMs: remaining,
    status,
    formattedTime: formatCountdown(remaining),
    lateRegEndDate: lateRegEnd,
    isLive: true,
  }
}

// Export helper for the dashboard widget API
export { calculateLateRegEnd, formatCountdown, getTodayInVegas }
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "use-late-reg" || echo "No errors"`

**Step 3: Commit**

```bash
git add src/hooks/use-late-reg-countdown.ts
git commit -m "feat: add useLateRegCountdown hook for live late reg tracking"
```

---

### Task 2: Create `<LateRegBadge>` Component

**Files:**
- Create: `src/components/late-reg-badge.tsx`

**Context:** Shared badge component used on tournament cards and detail pages. Uses `useLateRegCountdown` from Task 1. Follow the Badge styling from `src/components/ui/badge.tsx` and conditional rendering patterns from `src/components/tournament-card.tsx:67-91`.

**Step 1: Create the badge component**

```typescript
// src/components/late-reg-badge.tsx
'use client'

import { Tournament } from '@/types'
import { useLateRegCountdown, LateRegStatus } from '@/hooks/use-late-reg-countdown'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'

interface LateRegBadgeProps {
  tournament: Tournament
  /** 'sm' for cards, 'lg' for detail page */
  size?: 'sm' | 'lg'
  /** Show static info for future tournaments (default: true) */
  showStatic?: boolean
}

const STATUS_STYLES: Record<LateRegStatus, { bg: string; text: string; border: string }> = {
  open: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/30',
  },
  closing: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/30',
  },
  urgent: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/30',
  },
  closed: {
    bg: 'bg-gray-100 dark:bg-gray-500/15',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-500/30',
  },
  not_started: {
    bg: 'bg-gray-50 dark:bg-gray-500/10',
    text: 'text-muted-foreground',
    border: 'border-gray-200 dark:border-gray-500/20',
  },
  no_data: {
    bg: '',
    text: '',
    border: '',
  },
}

export function LateRegBadge({ tournament, size = 'sm', showStatic = true }: LateRegBadgeProps) {
  const intervalMs = size === 'lg' ? 1_000 : 60_000
  const { status, formattedTime, lateRegEndDate, isLive } = useLateRegCountdown(tournament, intervalMs)

  // No data — render nothing
  if (status === 'no_data') return null

  // Future tournament — show static text if enabled
  if (status === 'not_started' && showStatic && lateRegEndDate) {
    const endTimeStr = tournament.late_reg_end_time
      ? formatTime(tournament.late_reg_end_time)
      : tournament.late_reg_levels
        ? `${tournament.late_reg_levels} levels`
        : null

    if (!endTimeStr) return null

    if (size === 'lg') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          <span>Late reg through {endTimeStr}</span>
        </div>
      )
    }

    return null // Don't show static info on small cards
  }

  const styles = STATUS_STYLES[status]
  if (!styles.bg) return null

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg border px-4 py-2.5',
          styles.bg,
          styles.text,
          styles.border
        )}
      >
        <Timer className={cn('size-4 shrink-0', status === 'urgent' && 'animate-pulse')} />
        <div className="flex-1">
          {isLive ? (
            <>
              <span className="font-semibold">Late reg: {formattedTime}</span>
              {lateRegEndDate && (
                <span className="text-xs opacity-70 ml-2">
                  (closes at {lateRegEndDate.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/Los_Angeles',
                  })})
                </span>
              )}
            </>
          ) : (
            <span className="font-medium">Late reg closed</span>
          )}
        </div>
      </div>
    )
  }

  // Small badge for cards
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
        styles.bg,
        styles.text,
        styles.border
      )}
    >
      <Timer className={cn('size-3', status === 'urgent' && 'animate-pulse')} />
      {isLive ? `Late reg: ${formattedTime}` : 'Late reg closed'}
    </span>
  )
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "late-reg" || echo "No errors"`

**Step 3: Commit**

```bash
git add src/components/late-reg-badge.tsx
git commit -m "feat: add LateRegBadge component with color-coded countdown states"
```

---

### Task 3: Add Late Reg Badge to Tournament Cards

**Files:**
- Modify: `src/components/tournament-card.tsx`

**Context:** The tournament card is used on the browse page (`src/app/browse/page.tsx:159-171`) and favorites tab of the schedule page. It currently has 3 info rows (lines 44-91). Add the late reg badge as a new conditional row after info row 2 (after line 64). The card is wrapped in a `<Link>`, so the badge is display-only (no click handlers needed).

**Step 1: Add import for LateRegBadge**

At top of `src/components/tournament-card.tsx`, after line 9 (`import { QuickAddButton }`):

```typescript
import { LateRegBadge } from '@/components/late-reg-badge'
```

**Step 2: Add badge after info row 2**

After the info row 2 closing `</div>` (line 64), add:

```tsx
          {/* Late registration countdown (today's tournaments only) */}
          <LateRegBadge tournament={tournament} size="sm" showStatic={false} />
```

The `showStatic={false}` means badges only show for today's tournaments with active/closed countdowns, keeping future tournament cards clean.

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/tournament-card.tsx
git commit -m "feat: add late reg countdown badge to tournament cards"
```

---

### Task 4: Add Late Reg Countdown to Tournament Detail Page

**Files:**
- Modify: `src/app/tournament/[id]/page.tsx`

**Context:** This is a server component. The `LateRegBadge` is a client component (uses hooks), so it can be rendered inside a server component — Next.js handles this automatically. Add the countdown card after the Tournament Details card (after line 172). Also add static info display in the Tournament Details grid. Use `size="lg"` for the prominent per-second countdown.

**Step 1: Add import**

At top of `src/app/tournament/[id]/page.tsx`, after line 11 (`import { AdUnit }`):

```typescript
import { LateRegBadge } from '@/components/late-reg-badge'
```

**Step 2: Add countdown card after Tournament Details card**

After line 172 (`</Card>` closing the Tournament Details card), add:

```tsx
      {/* Late Registration Countdown */}
      <LateRegBadge tournament={tournament as Tournament} size="lg" showStatic={true} />
```

Note: `tournament` from Supabase is typed as `TournamentWithSeries` which extends `Tournament`. The cast ensures type compatibility.

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/tournament/[id]/page.tsx
git commit -m "feat: add late reg countdown to tournament detail page"
```

---

### Task 5: Create "Closing Soon" Dashboard Widget

**Files:**
- Create: `src/components/closing-soon-widget.tsx`
- Modify: `src/components/dashboard-authenticated.tsx`

**Context:** Add a new card to the authenticated dashboard showing today's tournaments where late reg is currently open or closing within 4 hours. The dashboard (`src/components/dashboard-authenticated.tsx`) already fetches schedule data via `useSchedule()`. This widget needs ALL today's tournaments (not just scheduled), so it fetches independently from Supabase. Place it between "Today's Schedule" (line 186) and "Trip Stats Row" (line 189).

**Step 1: Create the widget component**

```typescript
// src/components/closing-soon-widget.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tournament } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Timer } from 'lucide-react'
import { LateRegBadge } from '@/components/late-reg-badge'
import { formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/**
 * Get today in Vegas as YYYY-MM-DD.
 */
function getTodayVegas(): string {
  const now = new Date()
  const vegas = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const y = vegas.getFullYear()
  const m = String(vegas.getMonth() + 1).padStart(2, '0')
  const d = String(vegas.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Check if a tournament has late reg data and late reg hasn't closed yet.
 */
function hasActiveLateReg(t: Tournament): boolean {
  const now = new Date()
  const vegasNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))

  let endTime: Date | null = null

  if (t.late_reg_end_time) {
    endTime = new Date(`${t.date}T${t.late_reg_end_time}`)
  } else if (t.late_reg_levels && t.blind_levels_minutes && t.start_time) {
    const start = new Date(`${t.date}T${t.start_time}`)
    endTime = new Date(start.getTime() + t.late_reg_levels * t.blind_levels_minutes * 60 * 1000)
  }

  if (!endTime) return false

  // Show if late reg closes within the next 4 hours and hasn't closed yet
  const fourHours = 4 * 60 * 60 * 1000
  const remaining = endTime.getTime() - vegasNow.getTime()
  return remaining > 0 && remaining <= fourHours
}

export function ClosingSoonWidget() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTodaysTournaments() {
      const today = getTodayVegas()
      const supabase = createClient()

      const { data } = await supabase
        .from('tournaments')
        .select('*, series:series_id(*)')
        .eq('date', today)
        .not('late_reg_levels', 'is', null)
        .order('start_time', { ascending: true })

      if (data) {
        const active = (data as Tournament[]).filter(hasActiveLateReg)
        // Sort by soonest closing first
        active.sort((a, b) => {
          const endA = getEndMs(a)
          const endB = getEndMs(b)
          return endA - endB
        })
        setTournaments(active)
      }
      setLoading(false)
    }

    fetchTodaysTournaments()
    // Refresh every 2 minutes to pick up newly active tournaments
    const interval = setInterval(fetchTodaysTournaments, 120_000)
    return () => clearInterval(interval)
  }, [])

  // Don't show if loading or no tournaments with active late reg
  if (loading || tournaments.length === 0) return null

  return (
    <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="size-4 text-amber-600 dark:text-amber-400" />
          Late Reg Closing Soon
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tournaments.map((t) => {
            const seriesName = t.series?.name ?? ''
            const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
            return (
              <Link
                key={t.id}
                href={`/tournament/${t.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <div className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{formatTime(t.start_time)}</span>
                    <span>&middot;</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatBuyIn(t.buy_in)}
                    </span>
                  </div>
                </div>
                <LateRegBadge tournament={t} size="sm" />
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function getEndMs(t: Tournament): number {
  if (t.late_reg_end_time) {
    return new Date(`${t.date}T${t.late_reg_end_time}`).getTime()
  }
  if (t.late_reg_levels && t.blind_levels_minutes && t.start_time) {
    const start = new Date(`${t.date}T${t.start_time}`)
    return start.getTime() + t.late_reg_levels * t.blind_levels_minutes * 60 * 1000
  }
  return Infinity
}
```

**Step 2: Add widget to dashboard**

In `src/components/dashboard-authenticated.tsx`:

Add import after line 10 (`import { AdUnit }`):
```typescript
import { ClosingSoonWidget } from '@/components/closing-soon-widget'
```

Add the widget between "Today's Schedule" (line 186) and "Trip Stats Row" (line 189). After:
```tsx
      {/* 3. Today's Schedule */}
      <TodayScheduleCard entries={todayEntries} today={today} />
```

Add:
```tsx
      {/* 3b. Late Reg Closing Soon */}
      <ClosingSoonWidget />
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/closing-soon-widget.tsx src/components/dashboard-authenticated.tsx
git commit -m "feat: add Closing Soon dashboard widget for active late reg"
```

---

### Task 6: Enhance Scraper to Extract Late Reg Data

**Files:**
- Modify: `src/lib/scraper/parser.ts` (add detail extraction to `identifyFields`)
- Modify: `src/lib/scraper/types.ts` (add new fields to `RawScrapedRow`)
- Modify: `src/lib/scraper/pipeline.ts` (use extracted values instead of null)

**Context:** PokerAtlas markdown includes detail lines like `- 20,000 chips`, `- 20 min levels`, `- Late entry through level 8`. These are already being collected into a `details` array in `identifyFields()` (parser.ts:334-348) but only the guarantee is extracted from them. We need to also extract starting stack, blind level duration, and late reg levels from these detail lines.

**Step 1: Add new fields to `RawScrapedRow`**

In `src/lib/scraper/types.ts`, add 3 fields after `raw_event_type` (line 46):

```typescript
  /** Starting stack parsed from details, e.g. "20000" */
  raw_starting_stack: string
  /** Blind level duration in minutes, e.g. "20" */
  raw_blind_levels_minutes: string
  /** Number of late reg levels, e.g. "8" */
  raw_late_reg_levels: string
```

**Step 2: Update `identifyFields` return type and extraction**

In `src/lib/scraper/parser.ts`, update the `identifyFields` function:

Change the return type (line 303-310) to include:
```typescript
function identifyFields(lines: string[]): {
  eventType: string
  eventName: string
  buyIn: string
  gameType: string
  guarantee: string
  details: string[]
  startingStack: string
  blindLevelsMinutes: string
  lateRegLevels: string
}
```

Add variables after `const details: string[] = []` (line 316):
```typescript
  let startingStack = ''
  let blindLevelsMinutes = ''
  let lateRegLevels = ''
```

Inside the detail line processing block (after line 348, inside the `if (line.startsWith('- '))` block), add extraction logic before `continue`:

```typescript
      // Extract starting stack: "20,000 chips", "50000 Chips", "25,000 starting chips"
      if (/[\d,]+\s*(?:chips|starting)/i.test(detail) && !startingStack) {
        const stackMatch = detail.match(/([\d,]+)\s*(?:chips|starting)/i)
        if (stackMatch) startingStack = stackMatch[1].replace(/,/g, '')
      }
      // Extract blind level duration: "20 min levels", "30-min levels", "25 minute levels"
      if (/\d+\s*[-]?\s*min/i.test(detail) && !blindLevelsMinutes) {
        const levelMatch = detail.match(/(\d+)\s*[-]?\s*min/i)
        if (levelMatch) blindLevelsMinutes = levelMatch[1]
      }
      // Extract late reg levels: "Late entry through level 8", "Late reg through 6 levels",
      // "Late registration until level 10"
      if (/late\s*(?:reg|entry|registration)/i.test(detail) && !lateRegLevels) {
        const regMatch = detail.match(/(?:level|lvl)\s*(\d+)/i) ||
                         detail.match(/(\d+)\s*level/i)
        if (regMatch) lateRegLevels = regMatch[1]
      }
```

Update the return statement at line 472 to include the new fields:
```typescript
  return { eventType, eventName, buyIn, gameType, guarantee, details, startingStack, blindLevelsMinutes, lateRegLevels }
```

**Step 3: Update `parseBlock` and `parseBlockAlternate` to pass through new fields**

In `parseBlock` (line 138-148), update the return to include:
```typescript
    raw_starting_stack: details_result.startingStack || '',
    raw_blind_levels_minutes: details_result.blindLevelsMinutes || '',
    raw_late_reg_levels: details_result.lateRegLevels || '',
```

Note: you need to capture the identifyFields result. Change line 113:
```typescript
  const { eventType, eventName: rawEventName, buyIn: rawBuyIn, gameType: rawGameType, guarantee, details, startingStack, blindLevelsMinutes, lateRegLevels } =
    identifyFields(contentLines)
  let eventName = rawEventName
  let buyIn = rawBuyIn
  let gameType = rawGameType
```

Wait — the existing code uses `let` for some of these. Let me be more precise. The existing destructuring at line 113 is:
```typescript
  let { eventType, eventName, buyIn, gameType, guarantee, details } =
    identifyFields(contentLines)
```

Change this to:
```typescript
  let { eventType, eventName, buyIn, gameType, guarantee, details, startingStack, blindLevelsMinutes, lateRegLevels } =
    identifyFields(contentLines)
```

And update the return object (line 138-148) to add:
```typescript
    raw_starting_stack: startingStack,
    raw_blind_levels_minutes: blindLevelsMinutes,
    raw_late_reg_levels: lateRegLevels,
```

Do the same for `parseBlockAlternate` (line 195-205):
Change line 171:
```typescript
  let { eventType, eventName, buyIn, gameType, guarantee } =
    identifyFields(contentLines)
```
To:
```typescript
  let { eventType, eventName, buyIn, gameType, guarantee, startingStack, blindLevelsMinutes, lateRegLevels } =
    identifyFields(contentLines)
```

And add to the return (line 195-205):
```typescript
    raw_starting_stack: startingStack,
    raw_blind_levels_minutes: blindLevelsMinutes,
    raw_late_reg_levels: lateRegLevels,
```

**Step 4: Update pipeline to use extracted values**

In `src/lib/scraper/pipeline.ts`, change lines 84-87 from:
```typescript
        starting_stack: null,
        blind_levels_minutes: null,
        late_reg_levels: null,
        late_reg_end_time: null,
```
To:
```typescript
        starting_stack: raw.raw_starting_stack ? parseInt(raw.raw_starting_stack) : null,
        blind_levels_minutes: raw.raw_blind_levels_minutes ? parseInt(raw.raw_blind_levels_minutes) : null,
        late_reg_levels: raw.raw_late_reg_levels ? parseInt(raw.raw_late_reg_levels) : null,
        late_reg_end_time: null, // Calculated from levels if needed; explicit value via admin editor
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/lib/scraper/types.ts src/lib/scraper/parser.ts src/lib/scraper/pipeline.ts
git commit -m "feat: extract late reg levels, blind duration, starting stack from scraped data"
```

---

### Task 7: Create Admin Bulk Editor API Route

**Files:**
- Create: `src/app/api/admin/late-reg/route.ts`

**Context:** API route for the admin bulk editor. Supports:
- `GET` — fetch tournaments with optional filters (missing late reg data, date range, series)
- `PATCH` — bulk update late reg fields for multiple tournaments

Auth uses the same admin email check as existing admin routes (see `src/app/api/admin/import/route.ts`).

**Step 1: Create the API route**

```typescript
// src/app/api/admin/late-reg/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails) return false
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const missingOnly = searchParams.get('missing') === 'true'
  const seriesId = searchParams.get('series_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = supabase
    .from('tournaments')
    .select('id, name, date, start_time, buy_in, game_type, starting_stack, blind_levels_minutes, late_reg_levels, late_reg_end_time, series:series_id(id, name, venue)')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (missingOnly) {
    query = query.is('late_reg_levels', null)
  }
  if (seriesId) {
    query = query.eq('series_id', seriesId)
  }
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Array<{
    id: string
    blind_levels_minutes?: number | null
    late_reg_levels?: number | null
    late_reg_end_time?: string | null
    starting_stack?: number | null
  }> = body.updates

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  let successCount = 0
  const errors: string[] = []

  for (const update of updates) {
    const { id, ...fields } = update
    const { error } = await supabase
      .from('tournaments')
      .update(fields)
      .eq('id', id)

    if (error) {
      errors.push(`${id}: ${error.message}`)
    } else {
      successCount++
    }
  }

  return NextResponse.json({ updated: successCount, errors })
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/admin/late-reg/route.ts
git commit -m "feat: add admin API route for bulk late reg data editing"
```

---

### Task 8: Create Admin Bulk Editor Page

**Files:**
- Create: `src/app/admin/late-reg/page.tsx`

**Context:** Admin-only page for editing late reg fields. Follow the auth guard pattern from `src/app/admin/import/page.tsx` (lines 667-710). Show a filterable table of tournaments with inline-editable cells for `blind_levels_minutes`, `late_reg_levels`, and `late_reg_end_time`. Keep it simple — no complex table library needed.

**Step 1: Create the admin page**

```typescript
// src/app/admin/late-reg/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Timer, Save, Loader2, Filter, CheckCircle } from 'lucide-react'
import { formatDate, formatTime, formatBuyIn, getSeriesColor } from '@/lib/utils'

interface TournamentRow {
  id: string
  name: string
  date: string
  start_time: string
  buy_in: number
  game_type: string
  starting_stack: number | null
  blind_levels_minutes: number | null
  late_reg_levels: number | null
  late_reg_end_time: string | null
  series: { id: string; name: string; venue: string } | null
}

interface EditedFields {
  blind_levels_minutes?: number | null
  late_reg_levels?: number | null
  starting_stack?: number | null
}

function isAdmin(email: string | undefined | null): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails || !email) return false
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}

export default function AdminLateRegPage() {
  const { user, loading: userLoading } = useUser()
  const [tournaments, setTournaments] = useState<TournamentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, EditedFields>>({})
  const [missingOnly, setMissingOnly] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchTournaments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (missingOnly) params.set('missing', 'true')
      const res = await fetch(`/api/admin/late-reg?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTournaments(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [missingOnly])

  useEffect(() => {
    if (user && isAdmin(user.email)) {
      fetchTournaments()
    }
  }, [user, fetchTournaments])

  function handleEdit(id: string, field: keyof EditedFields, value: string) {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value === '' ? null : parseInt(value),
      },
    }))
  }

  async function handleSave() {
    const updates = Object.entries(edits)
      .filter(([, fields]) => Object.keys(fields).length > 0)
      .map(([id, fields]) => ({ id, ...fields }))

    if (updates.length === 0) return

    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/late-reg', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedback({ type: 'success', message: `Updated ${data.updated} tournaments.` })
        setEdits({})
        fetchTournaments()
      } else {
        setFeedback({ type: 'error', message: data.error || 'Failed to save.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="size-6 animate-spin" /></div>
  }

  if (!user || !isAdmin(user.email)) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Unauthorized</div>
  }

  const editCount = Object.keys(edits).length

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Timer className="size-6" />
            Late Registration Editor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fill in blind level duration and late reg levels for tournaments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMissingOnly(!missingOnly)}
          >
            <Filter className="size-4 mr-1" />
            {missingOnly ? 'Missing Only' : 'All'}
          </Button>
          {editCount > 0 && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
              Save {editCount} {editCount === 1 ? 'change' : 'changes'}
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`rounded-md border p-3 text-sm flex items-center gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          {feedback.type === 'success' && <CheckCircle className="size-4" />}
          {feedback.message}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {missingOnly ? 'All tournaments have late reg data!' : 'No tournaments found.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Tournament</th>
                    <th className="text-left py-3 px-3 font-medium w-24">Date</th>
                    <th className="text-left py-3 px-3 font-medium w-20">Time</th>
                    <th className="text-left py-3 px-3 font-medium w-20">Buy-in</th>
                    <th className="text-center py-3 px-3 font-medium w-24">Blind Lvl (min)</th>
                    <th className="text-center py-3 px-3 font-medium w-24">Late Reg Lvls</th>
                    <th className="text-center py-3 px-3 font-medium w-28">Starting Stack</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => {
                    const seriesName = t.series?.name ?? ''
                    const colors = getSeriesColor(seriesName, t.series?.venue, t.name)
                    const edited = edits[t.id] || {}
                    return (
                      <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`shrink-0 text-[10px] ${colors.bg} ${colors.text} border-0`}>
                              {colors.label}
                            </Badge>
                            <span className="truncate max-w-[250px]">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">{formatDate(t.date)}</td>
                        <td className="py-2 px-3 text-muted-foreground">{formatTime(t.start_time)}</td>
                        <td className="py-2 px-3 font-medium">{formatBuyIn(t.buy_in)}</td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            className="h-8 w-20 mx-auto text-center"
                            placeholder={t.blind_levels_minutes?.toString() ?? '—'}
                            value={edited.blind_levels_minutes !== undefined
                              ? (edited.blind_levels_minutes?.toString() ?? '')
                              : (t.blind_levels_minutes?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'blind_levels_minutes', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            className="h-8 w-20 mx-auto text-center"
                            placeholder={t.late_reg_levels?.toString() ?? '—'}
                            value={edited.late_reg_levels !== undefined
                              ? (edited.late_reg_levels?.toString() ?? '')
                              : (t.late_reg_levels?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'late_reg_levels', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min="1000"
                            className="h-8 w-24 mx-auto text-center"
                            placeholder={t.starting_stack?.toString() ?? '—'}
                            value={edited.starting_stack !== undefined
                              ? (edited.starting_stack?.toString() ?? '')
                              : (t.starting_stack?.toString() ?? '')}
                            onChange={(e) => handleEdit(t.id, 'starting_stack', e.target.value)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {tournaments.length} tournaments. {missingOnly ? 'Filtered to those missing late reg data.' : 'Showing all.'}
      </p>
    </div>
  )
}
```

**Step 2: Add admin nav link**

In `src/components/left-sidebar.tsx`, the admin link currently goes to `/admin/import` (line 132). This is fine — the user can navigate from import to late-reg manually. No sidebar change needed.

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/admin/late-reg/page.tsx src/app/api/admin/late-reg/route.ts
git commit -m "feat: add admin bulk editor for late registration data"
```

---

### Task 9: Build, Test, and Deploy

**Files:** None (verification only)

**Step 1: Full build**

Run: `npm run build`
Expected: Successful build with all new routes visible:
- `/admin/late-reg`
- `/api/admin/late-reg`

**Step 2: Verify git status is clean**

Run: `git status`
Expected: Clean working tree (all changes committed)

**Step 3: Push to remote**

```bash
git push
```

**Step 4: Deploy to Vercel**

```bash
npx vercel --prod
```

**Step 5: Verify deployment**

Expected: Deployment succeeds, aliased to `nextrebuy.com`

---

## Implementation Notes

### Testing Late Reg Countdowns Locally

Since tournament data likely doesn't have late reg fields populated yet, you can test by:

1. Go to `/admin/late-reg` and fill in data for a few tournaments happening today
2. Set `blind_levels_minutes` to 20 and `late_reg_levels` to 8 for a tournament starting soon
3. Check the browse page and dashboard for the countdown badges

### Future Enhancements (Not in Scope)

- Push notifications when late reg is about to close
- PokerDiscover scraping as secondary data source
- PDF parsing for WSOP/Wynn/Venetian structure sheets
- Automatic `late_reg_end_time` calculation stored in DB
