# Casino/Series Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add color-coded casino filter badges to the Browse page sidebar so users can filter tournaments by casino/series (WSOP, Venetian, Wynn, etc.).

**Architecture:** Name-based filtering using the existing `series` join. The `SERIES_COLORS` keys serve as the casino list. Supabase filters on `series.name` using `.ilike()` for flexible matching. URL params use `casino=WSOP&casino=Venetian` pattern.

**Tech Stack:** Next.js 16, React 19, Supabase PostgREST, Tailwind CSS 4, shadcn/ui

---

### Task 1: Add `casinos` field to TournamentFilters type

**Files:**
- Modify: `src/types/index.ts:64-82`

**Step 1: Add the casinos field**

In `src/types/index.ts`, add `casinos?: string[]` to the `TournamentFilters` interface, right after `seriesIds`:

```typescript
export interface TournamentFilters {
  dateFrom?: string
  dateTo?: string
  seriesIds?: string[]
  casinos?: string[]          // <-- ADD THIS LINE
  buyInMin?: number
  buyInMax?: number
  // ... rest unchanged
}
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (no consumers of `casinos` yet)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add casinos field to TournamentFilters type"
```

---

### Task 2: Add casino filtering to query builder

**Files:**
- Modify: `src/lib/queries.ts:14-70` (buildTournamentQuery)
- Modify: `src/lib/queries.ts:72-100` (buildCountQuery)

**Step 1: Add casino filtering to `buildTournamentQuery`**

In `src/lib/queries.ts`, after the `seriesIds` filter (line 24), add casino name filtering. Supabase PostgREST supports filtering on foreign table columns using the relationship name. We need to build an `.or()` filter with `.ilike()` conditions for each casino name on the `series` relationship:

```typescript
  if (filters.seriesIds?.length) query = query.in('series_id', filters.seriesIds)

  // Casino name filter — match series name containing casino keyword
  if (filters.casinos?.length) {
    const casinoFilters = filters.casinos
      .map(c => `name.ilike.%${c}%`)
      .join(',')
    query = query.or(casinoFilters, { referencedTable: 'series' })
  }
```

Note: The `referencedTable` option tells Supabase to apply the `.or()` filter on the joined `series` table, not the `tournaments` table. The join alias in the select is `series:series_id(...)`, so the referencedTable is `series`.

**Step 2: Add same filter to `buildCountQuery`**

In `buildCountQuery`, after the `seriesIds` filter, add the same casino filtering. But since the count query uses `select('id', { count: 'exact', head: true })` without a series join, we need a different approach. We'll subquery by first getting matching series IDs:

Actually, the simpler approach for the count query: we need to add the series join to the count query too. Update `buildCountQuery`:

```typescript
export function buildCountQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('id, series:series_id(name)', { count: 'exact', head: true })

  // ... existing filters unchanged ...

  // Casino name filter
  if (filters.casinos?.length) {
    const casinoFilters = filters.casinos
      .map(c => `name.ilike.%${c}%`)
      .join(',')
    query = query.or(casinoFilters, { referencedTable: 'series' })
  }

  return query
}
```

The key change is adding `series:series_id(name)` to the count query's select so the referencedTable filter works.

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add casino name filtering to tournament queries"
```

---

### Task 3: Parse casino URL params in API route

**Files:**
- Modify: `src/app/api/tournaments/route.ts:13-28`

**Step 1: Add casino param parsing**

In the GET handler, after `seriesIds` parsing (line 16), add:

```typescript
    casinos: searchParams.getAll('casino').filter(Boolean),
```

So the filters object becomes:

```typescript
  const filters: TournamentFilters = {
    dateFrom: searchParams.get('dateFrom') || new Date().toISOString().split('T')[0],
    dateTo: searchParams.get('dateTo') || undefined,
    seriesIds: searchParams.getAll('seriesId').filter(Boolean),
    casinos: searchParams.getAll('casino').filter(Boolean),    // <-- ADD
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    // ... rest unchanged
  }
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/tournaments/route.ts
git commit -m "feat: parse casino query params in tournaments API"
```

---

### Task 4: Add casino to filter hook

**Files:**
- Modify: `src/hooks/use-tournament-filters.ts`

**Step 1: Parse casino params and add to filterCount**

In `useTournamentFilters`, add `casinos` to the parsed filters and update `filterCount`:

In the `filters` useMemo (around line 11):
```typescript
  const filters: TournamentFilters = useMemo(() => ({
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    casinos: searchParams.getAll('casino').filter(Boolean),    // <-- ADD after dateTo
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    // ... rest unchanged
  }), [searchParams])
```

In the `filterCount` useMemo (around line 65), add after the existing checks:
```typescript
    if (filters.casinos?.length) count++
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/hooks/use-tournament-filters.ts
git commit -m "feat: parse casino filter params in filter hook"
```

---

### Task 5: Add Casino filter badges to sidebar UI

**Files:**
- Modify: `src/components/tournament-filters.tsx`

**Step 1: Import SERIES_COLORS**

At the top of the file, add:
```typescript
import { SERIES_COLORS } from '@/types'
```

**Step 2: Add CASINO_KEYS constant and toggle handler**

Inside `FilterSections`, add the casino list and toggle function (after the existing `toggleFormat` function around line 76):

```typescript
  const CASINO_KEYS = Object.keys(SERIES_COLORS).filter(k => k !== 'default')

  const toggleCasino = (casino: string) => {
    const current = filters.casinos || []
    const next = current.includes(casino)
      ? current.filter(c => c !== casino)
      : [...current, casino]
    setFilter('casino', next.length > 0 ? next : null)
  }
```

**Step 3: Add Casino section as the first filter section**

In the JSX return, add the Casino section **right after the "Clear All" button** and **before the Date section**:

```tsx
      {/* Casino */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">Casino</h4>
        <div className="flex flex-wrap gap-1.5">
          {CASINO_KEYS.map((casino) => {
            const colors = SERIES_COLORS[casino]
            const isSelected = (filters.casinos || []).includes(casino)
            return (
              <Badge
                key={casino}
                variant="outline"
                className={`cursor-pointer text-xs select-none transition-colors ${
                  isSelected
                    ? `${colors.bg} ${colors.text} border-transparent`
                    : 'hover:bg-muted'
                }`}
                onClick={() => toggleCasino(casino)}
              >
                <span className={`inline-block size-2 rounded-full mr-1.5 ${colors.dot}`} />
                {colors.label}
              </Badge>
            )
          })}
        </div>
      </div>
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Manual test**

Run the dev server and verify:
1. Casino badges appear at the top of the filter sidebar
2. Each badge shows its brand color dot
3. Clicking a badge highlights it with its brand color
4. Clicking multiple badges shows tournaments from all selected casinos
5. The filter count updates
6. "Clear all filters" resets casino selection
7. Mobile sheet also shows the casino filter

**Step 6: Commit**

```bash
git add src/components/tournament-filters.tsx
git commit -m "feat: add color-coded casino filter badges to sidebar"
```

---

### Task 6: Final verification and push

**Step 1: Full build check**

Run: `npm run build 2>&1 | tail -10`
Expected: Clean build, no warnings

**Step 2: Push to remote**

```bash
git push origin main
```

**Step 3: Deploy to Vercel**

Use vercel:deploy skill.
