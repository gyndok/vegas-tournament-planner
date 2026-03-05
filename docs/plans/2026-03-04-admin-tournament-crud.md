# Admin Tournament CRUD — Unified Admin Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace scattered admin pages with a unified `/admin` hub providing full CRUD for tournaments — searchable list, slide-over edit panel, add-new form, and the existing import/scrape flow.

**Architecture:** Single client-side page at `/admin` with Radix Tabs (Tournaments | Import | Add New). The Tournaments tab uses a server API for filtered/paginated listing. Editing uses a Sheet (slide-over panel) from the right. A new `/api/admin/tournaments` route handles GET/POST/PATCH/DELETE. Old `/admin/import` and `/admin/late-reg` pages are deleted once absorbed.

**Tech Stack:** Next.js 16, React, Supabase (server client + admin client), Radix UI (Tabs, Sheet, Dialog), Tailwind CSS, Lucide icons.

---

### Task 1: Create the Admin Tournaments API Route

**Files:**
- Create: `src/app/api/admin/tournaments/route.ts`
- Reference: `src/app/api/admin/late-reg/route.ts` (auth pattern)
- Reference: `src/app/api/admin/import/route.ts` (create pattern)
- Reference: `src/lib/queries.ts` (query building)
- Reference: `src/lib/admin.ts` (isAdminEmail)
- Reference: `src/types/index.ts` (Tournament interface)

**Step 1: Create the API route file with all four HTTP methods**

Create `src/app/api/admin/tournaments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'

// --- Auth helper ---
async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email)) return null
  return user
}

// --- GET: List tournaments with search, filters, pagination ---
export async function GET(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')
  const seriesId = searchParams.get('series_id')
  const gameType = searchParams.get('game_type')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const sortBy = searchParams.get('sort_by') || 'date'
  const sortDir = searchParams.get('sort_dir') || 'desc'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  const supabase = await createClient()

  // Count query
  let countQuery = supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })

  // Data query
  let query = supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')

  // Apply filters to both
  for (const q of [countQuery, query]) {
    if (search) {
      // Search by tournament name or series name via ilike
      // We can only filter tournament name directly; series filtering needs a different approach
      q.ilike('name', `%${search}%`)
    }
    if (seriesId) q.eq('series_id', seriesId)
    if (gameType) q.eq('game_type', gameType)
    if (dateFrom) q.gte('date', dateFrom)
    if (dateTo) q.lte('date', dateTo)
  }

  // Apply filters to count query separately since we can't iterate over both
  // (Supabase query builder is mutable, so the loop above works)

  // Sorting
  const ascending = sortDir === 'asc'
  switch (sortBy) {
    case 'buy_in':
      query = query.order('buy_in', { ascending }).order('date').order('id')
      break
    case 'name':
      query = query.order('name', { ascending }).order('id')
      break
    case 'date':
    default:
      query = query.order('date', { ascending }).order('start_time', { ascending }).order('id')
      break
  }

  // Pagination
  query = query.range(offset, offset + limit - 1)

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    query,
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: data || [],
    totalCount: count || 0,
    offset,
    limit,
  })
}

// --- POST: Create a single tournament ---
export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { tournament, new_series } = body as {
    tournament: Record<string, unknown>
    new_series?: {
      name: string
      venue: string
      start_date: string
      end_date: string
      website_url?: string
    }
  }

  const supabase = createAdminClient()
  let seriesId = tournament.series_id as string | undefined

  // Create new series if requested
  if (new_series) {
    if (!new_series.name || !new_series.venue || !new_series.start_date || !new_series.end_date) {
      return NextResponse.json({ error: 'New series requires name, venue, start_date, end_date' }, { status: 400 })
    }
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .insert({
        name: new_series.name,
        venue: new_series.venue,
        start_date: new_series.start_date,
        end_date: new_series.end_date,
        website_url: new_series.website_url || null,
      })
      .select('id')
      .single()

    if (seriesError) {
      return NextResponse.json({ error: `Failed to create series: ${seriesError.message}` }, { status: 500 })
    }
    seriesId = seriesData.id
  }

  // Validate required fields
  const name = tournament.name as string
  const date = tournament.date as string
  const startTime = tournament.start_time as string
  const buyIn = Number(tournament.buy_in)
  const gameType = tournament.game_type as string

  if (!name || !date || !startTime || isNaN(buyIn) || !gameType || !seriesId) {
    return NextResponse.json({
      error: 'Missing required fields: name, date, start_time, buy_in, game_type, series_id'
    }, { status: 400 })
  }

  const insertPayload = {
    series_id: seriesId,
    event_number: Number(tournament.event_number) || 0,
    name,
    date,
    day_of_week: (tournament.day_of_week as string) || '',
    start_time: startTime,
    buy_in: buyIn,
    game_type: gameType,
    format: (tournament.format as string) || 'Re-entry',
    table_size: Number(tournament.table_size) || 9,
    starting_stack: tournament.starting_stack ? Number(tournament.starting_stack) : null,
    blind_levels_minutes: tournament.blind_levels_minutes ? Number(tournament.blind_levels_minutes) : null,
    late_reg_levels: tournament.late_reg_levels ? Number(tournament.late_reg_levels) : null,
    late_reg_end_time: (tournament.late_reg_end_time as string) || null,
    guaranteed_prize: tournament.guaranteed_prize ? Number(tournament.guaranteed_prize) : null,
    is_flight: tournament.is_flight === true,
    flight_label: (tournament.flight_label as string) || null,
    parent_event_number: tournament.parent_event_number ? Number(tournament.parent_event_number) : null,
    estimated_duration_hours: tournament.estimated_duration_hours ? Number(tournament.estimated_duration_hours) : null,
    notes: (tournament.notes as string) || null,
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert(insertPayload)
    .select('*, series:series_id(id, name, venue)')
    .single()

  if (error) {
    return NextResponse.json({ error: `Create failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ tournament: data })
}

// --- PATCH: Update a single tournament ---
export async function PATCH(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body as { id: string; [key: string]: unknown }

  if (!id) {
    return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 })
  }

  // Remove fields that shouldn't be updated directly
  delete fields.created_at
  delete fields.series

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tournaments')
    .update(fields)
    .eq('id', id)
    .select('*, series:series_id(id, name, venue)')
    .single()

  if (error) {
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ tournament: data })
}

// --- DELETE: Delete a single tournament ---
export async function DELETE(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id } = body as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Delete related user_schedule entries
  await supabase.from('user_schedule').delete().eq('tournament_id', id)
  // Delete related user_favorites entries
  await supabase.from('user_favorites').delete().eq('tournament_id', id)
  // Delete the tournament
  const { error } = await supabase.from('tournaments').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
```

**Important notes for implementer:**
- The `getAdminUser()` helper follows the exact pattern from `src/app/api/admin/late-reg/route.ts` lines 4-9
- The `createAdminClient()` uses the service role key for write operations, matching `src/app/api/admin/import/route.ts` line 158
- The search filter uses Supabase `.ilike()` on tournament name — this is a simple approach. Note: the count and data queries must have filters applied separately since Supabase query builders are mutable chains (the loop approach in the skeleton above won't work — apply filters to each query individually)
- Offset-based pagination is simpler than cursor-based for admin use where we need total counts and page jumping

**Step 2: Verify the route builds**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -E "(error|admin/tournaments)"`
Expected: No errors, `/api/admin/tournaments` appears in routes

**Step 3: Commit**

```bash
git add src/app/api/admin/tournaments/route.ts
git commit -m "feat: add admin tournaments CRUD API route (GET/POST/PATCH/DELETE)"
```

---

### Task 2: Create the Admin Page Shell with Tabs

**Files:**
- Create: `src/app/admin/page.tsx`
- Modify: `src/components/left-sidebar.tsx:156` (change admin link from `/admin/import` to `/admin`)
- Reference: `src/app/admin/import/page.tsx` (auth guard pattern, tab UI)
- Reference: `src/components/ui/tabs.tsx` (Tabs, TabsList, TabsTrigger, TabsContent)

**Step 1: Create the unified admin page shell**

Create `src/app/admin/page.tsx` with:
- The same auth guard pattern from `src/app/admin/import/page.tsx` lines 667-710 (useUser, isClientAdmin, loading/unauthenticated/unauthorized states)
- Radix Tabs with three tabs: "Tournaments", "Import", "Add New"
- Import the existing `ScrapeTab` and `PasteDataTab` components — but since they're defined inside `import/page.tsx` and not exported, we'll need to either: (a) extract them to shared files, or (b) for now, put placeholder content in the Import tab and handle extraction in a later task
- For this task, just create the shell with tab structure. Tournaments tab shows "Coming soon" placeholder. Import tab shows a note linking to `/admin/import` temporarily. Add New tab shows placeholder.

```tsx
'use client'

import { useState } from 'react'
import { useUser } from '@/hooks/use-user'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Loader2,
  LogIn,
  ShieldAlert,
  AlertTriangle,
  List,
  Upload,
  Plus,
} from 'lucide-react'

function isClientAdmin(email: string | undefined | null): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS
  if (!adminEmails || !email) return false
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase())
}

export default function AdminPage() {
  const { user, loading: userLoading } = useUser()

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <LogIn className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You must be signed in to access this page.</p>
        </div>
      </div>
    )
  }

  if (!isClientAdmin(user.email)) {
    return (
      <div className="px-4 md:px-6 py-6">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <ShieldAlert className="size-10 text-destructive" />
          <p className="text-sm text-muted-foreground">Access denied. This page is restricted to administrators.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-6">
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
        <AlertTriangle className="size-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <span className="text-sm text-yellow-700 dark:text-yellow-200">Admin area &mdash; tournament management</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <Tabs defaultValue="tournaments">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="tournaments" className="gap-2">
            <List className="size-4" />
            Tournaments
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="size-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="add-new" className="gap-2">
            <Plus className="size-4" />
            Add New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments">
          {/* TournamentsTab will be added in Task 3 */}
          <div className="text-center py-12 text-muted-foreground">Tournaments list loading...</div>
        </TabsContent>

        <TabsContent value="import">
          {/* ImportTab will be inlined in Task 5 */}
          <div className="text-center py-12 text-muted-foreground">Import tab loading...</div>
        </TabsContent>

        <TabsContent value="add-new">
          {/* AddNewTab will be added in Task 4 */}
          <div className="text-center py-12 text-muted-foreground">Add new form loading...</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Step 2: Update the sidebar admin link**

In `src/components/left-sidebar.tsx`, line 156, change:
```
href="/admin/import"
```
to:
```
href="/admin"
```

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -E "(error|/admin)"`
Expected: `/admin` appears as static page, no errors

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/left-sidebar.tsx
git commit -m "feat: add unified admin page shell with tab structure"
```

---

### Task 3: Build the Tournaments List Tab

**Files:**
- Modify: `src/app/admin/page.tsx` (replace tournaments tab placeholder)
- Reference: `src/app/api/admin/tournaments/route.ts` (API contract)
- Reference: `src/app/admin/late-reg/page.tsx` (table patterns, inline styling)
- Reference: `src/lib/utils.ts` (formatBuyIn, formatTime, formatDate, getSeriesColor)
- Reference: `src/types/index.ts` (Tournament, Series types)

**Step 1: Add the TournamentsTab component**

Add a `TournamentsTab` component inside `src/app/admin/page.tsx` that:

- Has a top bar with:
  - Search input (debounced, 300ms) filtering by tournament name
  - Series/casino dropdown filter (fetched from Supabase `series` table)
  - Game type dropdown filter
  - Date range inputs (from/to)
  - Count display: "Showing X of Y tournaments"

- Has a data table with columns:
  | Date | Time | Tournament | Casino | Buy-in | Game | Format | GTD |
  - Rows are clickable (entire row) — clicking sets `selectedTournamentId` state
  - Each row shows series color badge (using `getSeriesColor`)
  - Uses `formatDate`, `formatTime`, `formatBuyIn` from `src/lib/utils.ts`

- Pagination controls at the bottom:
  - "Previous" / "Next" buttons
  - Shows "Page X of Y"
  - Uses offset-based pagination from the API

- State:
  - `tournaments: Tournament[]`
  - `totalCount: number`
  - `loading: boolean`
  - `search: string`
  - `seriesId: string` (filter)
  - `gameType: string` (filter)
  - `dateFrom: string`
  - `dateTo: string`
  - `page: number` (current page, 0-indexed)
  - `selectedTournamentId: string | null` (for opening the edit sheet)

- Fetches from `GET /api/admin/tournaments` with query params

- The `selectedTournamentId` state will be lifted to the parent `AdminPage` component so the Sheet (built in Task 4) can access it

**Key implementation detail:** The `onRowClick` callback should set the selected tournament and open the edit panel. Wire this up by passing `selectedTournament` / `setSelectedTournament` as props from the parent.

**Step 2: Replace the placeholder in the Tournaments TabsContent**

Replace `<div className="text-center py-12 text-muted-foreground">Tournaments list loading...</div>` with `<TournamentsTab ... />`

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -i error`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add tournaments list tab with search, filters, and pagination"
```

---

### Task 4: Build the Edit Slide-Over Panel

**Files:**
- Modify: `src/app/admin/page.tsx` (add Sheet for editing + delete confirmation Dialog)
- Reference: `src/components/ui/sheet.tsx` (Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter)
- Reference: `src/components/ui/dialog.tsx` (Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter)
- Reference: `src/types/index.ts` (Tournament interface — all 20+ fields)

**Step 1: Add the TournamentEditSheet component**

Create a `TournamentEditSheet` component that:

- Is a Sheet (slide-over from right, `side="right"`) — uses existing `Sheet` / `SheetContent` from `src/components/ui/sheet.tsx`
- Override SheetContent width to be wider: add `className="sm:max-w-lg"` (or `sm:max-w-xl` for more space)
- Props: `tournament: Tournament | null`, `open: boolean`, `onOpenChange`, `onSaved`, `onDeleted`
- Uses `ScrollArea` from `src/components/ui/scroll-area.tsx` for the body so it scrolls if content is taller than viewport

- **Header:** Tournament name (or "Edit Tournament")
- **Body:** Form fields organized in sections with `<fieldset>` + `<legend>` or just section headers:

  **Core Info:**
  - Name (text input, required)
  - Event # (number input)
  - Date (date input, required)
  - Day of Week (text input — auto-computed from date would be nice but not required)
  - Start Time (time input, required)

  **Game Details:**
  - Buy-in (number input, required)
  - Game Type (select: NLH, PLO, Mixed, etc. — derive options from existing data)
  - Format (text input: Re-entry, Freezeout, etc.)
  - Table Size (number input, default 9)

  **Structure:**
  - Starting Stack (number input)
  - Blind Levels (min) (number input)
  - Late Reg Levels (number input)
  - Late Reg End Time (time input)

  **Prize:**
  - Guaranteed Prize (number input)

  **Flight Info:**
  - Is Flight (checkbox/switch)
  - Flight Label (text input, shown only if Is Flight)
  - Parent Event # (number input, shown only if Is Flight)

  **Other:**
  - Estimated Duration (number input, hours)
  - Notes (textarea)

- **Footer:**
  - Save button (calls `PATCH /api/admin/tournaments` with changed fields only)
  - Cancel button (closes sheet)
  - Delete button (red, bottom — opens confirmation Dialog)

- **Delete confirmation:** Uses Dialog component. "Are you sure you want to delete [tournament name]? This will also remove it from all user schedules and favorites." with Cancel / Delete buttons.

- State management:
  - Initialize form state from `tournament` prop when it changes
  - Track dirty fields to only send changed values in PATCH
  - Show saving/deleting loading states
  - On successful save, call `onSaved()` callback (parent refreshes list)
  - On successful delete, call `onDeleted()` callback (parent refreshes list, closes panel)

**Step 2: Wire up in AdminPage**

In the parent `AdminPage` component:
- Add `selectedTournament` / `setSelectedTournament` state
- Add `sheetOpen` / `setSheetOpen` state
- Render `<TournamentEditSheet>` outside the Tabs
- When TournamentsTab row is clicked, set the selected tournament and open the sheet
- On save/delete callbacks, refresh the tournament list

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -i error`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add tournament edit slide-over panel with delete confirmation"
```

---

### Task 5: Build the Add New Tab and Inline the Import Tab

**Files:**
- Modify: `src/app/admin/page.tsx` (add AddNewTab content, inline Import tab content)
- Reference: `src/app/admin/import/page.tsx` (ScrapeTab, PasteDataTab, CasinoCard — all components to inline)
- Reference: `src/lib/scraper/casino-configs.ts` (CASINO_CONFIGS import)

**Step 1: Build the Add New tab**

The Add New tab uses the same form layout as the edit panel, but rendered full-width in the page (not in a sheet).

Create `AddNewTab` component that:
- Has a series picker at the top:
  - Select dropdown listing existing series (fetched from Supabase)
  - Option to "Create New Series" which shows inline series form (name, venue, start_date, end_date, website_url) — exact same pattern as `src/app/admin/import/page.tsx` lines 428-498
- Below the series picker, show the tournament form fields (same sections as the edit panel)
- Submit button calls `POST /api/admin/tournaments`
- On success: show green success feedback with link to the newly created tournament
- Clear form after successful creation

**Step 2: Inline the Import tab**

Move the `ScrapeTab`, `CasinoCard`, `PasteDataTab`, CSV parsing helpers, and `SAMPLE_JSON`/`SAMPLE_CSV` constants from `src/app/admin/import/page.tsx` into the admin page file (or a separate file imported by it).

The simplest approach: extract the import-related components to `src/components/admin/import-tab.tsx` and import that component into the admin page. This keeps the admin page file manageable.

Create `src/components/admin/import-tab.tsx`:
- Copy `ScrapeTab`, `CasinoCard`, `PasteDataTab`, `parseCSVLine`, `parseCSVData`, `PreviewRow`, `SAMPLE_JSON`, `SAMPLE_CSV`, `ImportResult`, `CasinoScrapeState`, `ScrapeState` from `src/app/admin/import/page.tsx`
- Export a single `ImportTab` component that renders the scrape/paste sub-tabs (lines 722-744 of the original)
- This component handles its own sub-tab state (`'scrape' | 'paste'`)

Then in `src/app/admin/page.tsx`, replace the Import tab placeholder with `<ImportTab />`.

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -i error`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/import-tab.tsx
git commit -m "feat: add tournament creation form and inline import tab in admin hub"
```

---

### Task 6: Delete Old Admin Pages

**Files:**
- Delete: `src/app/admin/import/page.tsx`
- Delete: `src/app/admin/late-reg/page.tsx`
- Delete: `src/app/api/admin/late-reg/route.ts`

**Step 1: Delete the old files**

```bash
rm src/app/admin/import/page.tsx
rm src/app/admin/late-reg/page.tsx
rm src/app/api/admin/late-reg/route.ts
```

**Note:** Keep the `src/app/admin/import/` and `src/app/admin/late-reg/` directories if Next.js needs them, but if they're empty they can be removed too (rmdir).

**Step 2: Check for any imports referencing deleted files**

Search for any references to the deleted paths:
```bash
grep -r "admin/import" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -r "admin/late-reg" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Fix any broken references (the sidebar link was already updated in Task 2).

**Step 3: Verify build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build 2>&1 | grep -i error`
Expected: No errors. Old routes `/admin/import` and `/admin/late-reg` should no longer appear in build output. `/admin` should be present.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old admin/import and admin/late-reg pages (absorbed into /admin)"
```

---

### Task 7: Build, Push, and Deploy

**Files:**
- No file changes

**Step 1: Full production build**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && npx next build`
Expected: Successful build with routes:
- `/admin` (static or dynamic)
- `/api/admin/tournaments` (dynamic)
- No `/admin/import` or `/admin/late-reg`

**Step 2: Push to remote**

```bash
git push
```

**Step 3: Deploy to Vercel**

```bash
npx vercel --prod
```
Expected: Successful deployment to https://nextrebuy.com

**Step 4: Smoke test**

Navigate to https://nextrebuy.com/admin and verify:
- Tournaments tab shows the list with search/filter
- Clicking a row opens the edit slide-over
- Edit panel saves changes
- Add New tab creates a tournament
- Import tab scrapes/imports correctly
- Delete works with confirmation

---

## Summary of Files

**Created:**
- `src/app/api/admin/tournaments/route.ts` — CRUD API (GET/POST/PATCH/DELETE)
- `src/app/admin/page.tsx` — Unified admin hub with tabs
- `src/components/admin/import-tab.tsx` — Extracted import components

**Modified:**
- `src/components/left-sidebar.tsx` — Admin link changed to `/admin`

**Deleted:**
- `src/app/admin/import/page.tsx` — Absorbed into admin hub Import tab
- `src/app/admin/late-reg/page.tsx` — Redundant, all fields editable via edit panel
- `src/app/api/admin/late-reg/route.ts` — Replaced by `/api/admin/tournaments` PATCH
