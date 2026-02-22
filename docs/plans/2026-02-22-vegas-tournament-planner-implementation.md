# Vegas Tournament Planner — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered web app that helps poker players browse, filter, and plan their tournament schedule across Las Vegas poker festivals.

**Architecture:** Next.js 15 App Router with Supabase (PostgreSQL) for data, Anthropic Claude API for the AI chat planner, and Tailwind CSS + shadcn/ui for the dark-mode mobile-first UI. Feature-layered MVP: Data+Browse → AI Chat → Auth+Personalization → Admin.

**Tech Stack:** Next.js 15, Supabase, Anthropic SDK, Tailwind CSS v4, shadcn/ui, TypeScript

**Source data:** WSOP 2026 PDF (18 pages, 100 events) at `~/Downloads/WSOP Tournaments & Event Schedule | WSOP.com.pdf` and Excel at `~/Downloads/wsop_2026_schedule.xlsx`. The WSOP website URL is `https://www.wsop.com/tournaments/2026-57th-annual-world-series-of-poker/`.

---

## Layer 1: Data + Browse

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.local.example`, `.gitignore`

**Step 1: Create Next.js app**

```bash
cd ~/Developer/vegas-tournament-planner
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full scaffold.

**Step 2: Install core dependencies**

```bash
cd ~/Developer/vegas-tournament-planner
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D @types/node
```

**Step 3: Create .env.local.example**

Create `~/Developer/vegas-tournament-planner/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

**Step 4: Create .env.local with placeholders**

Copy `.env.local.example` to `.env.local` with placeholder values so the app can start without crashing (we'll add real values when Supabase is configured).

**Step 5: Verify the app starts**

```bash
cd ~/Developer/vegas-tournament-planner && npm run dev
```

Visit http://localhost:3000 — should see the default Next.js page.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js 15 project with dependencies"
```

---

### Task 2: Initialize shadcn/ui and configure dark theme

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`
- Create: `components.json`

**Step 1: Initialize shadcn/ui**

```bash
cd ~/Developer/vegas-tournament-planner
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

**Step 2: Install commonly needed shadcn components**

```bash
npx shadcn@latest add button card input label select badge separator sheet dialog dropdown-menu slider tabs tooltip scroll-area
```

**Step 3: Configure dark theme in layout.tsx**

Edit `src/app/layout.tsx` — set `<html>` to have `className="dark"` and update the body background to `bg-[#0a0a0a]`. Set metadata title to "Vegas Tournament Planner" and description to "AI-powered poker tournament scheduling for Las Vegas festivals".

**Step 4: Update globals.css dark theme colors**

In `src/app/globals.css`, update the `:root` dark theme CSS variables:
- `--background`: `0 0% 4%` (#0a0a0a)
- `--card`: `0 0% 10%` (#1a1a1a)
- `--border`: `0 0% 16%` (#2a2a2a)
- `--primary`: `142 71% 45%` (#22c55e — poker green)
- `--primary-foreground`: `0 0% 100%`

**Step 5: Verify dark theme renders**

```bash
cd ~/Developer/vegas-tournament-planner && npm run dev
```

Page should show dark background.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: configure shadcn/ui with dark poker theme"
```

---

### Task 3: Define TypeScript types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create the types file**

Create `src/types/index.ts`:

```typescript
export interface Series {
  id: string
  name: string
  venue: string
  start_date: string
  end_date: string
  website_url: string | null
  created_at: string
}

export interface Tournament {
  id: string
  series_id: string
  event_number: number
  name: string
  date: string
  day_of_week: string
  start_time: string
  buy_in: number
  game_type: string
  format: string
  table_size: number
  starting_stack: number | null
  blind_levels_minutes: number | null
  late_reg_levels: number | null
  late_reg_end_time: string | null
  guaranteed_prize: number | null
  is_flight: boolean
  flight_label: string | null
  parent_event_number: number | null
  estimated_duration_hours: number | null
  notes: string | null
  created_at: string
  // Joined fields
  series?: Series
}

export interface UserPreferences {
  id: string
  user_id: string
  buy_in_min: number | null
  buy_in_max: number | null
  preferred_games: string[]
  preferred_formats: string[]
  preferred_start_time_earliest: string | null
  preferred_start_time_latest: string | null
  preferred_table_size: number[]
  avoid_turbos: boolean
  trip_start: string | null
  trip_end: string | null
  created_at: string
  updated_at: string
}

export interface UserScheduleEntry {
  id: string
  user_id: string
  tournament_id: string
  priority: 'target' | 'backup' | 'maybe'
  notes: string | null
  created_at: string
  // Joined
  tournament?: Tournament
}

export interface TournamentFilters {
  dateFrom?: string
  dateTo?: string
  seriesIds?: string[]
  buyInMin?: number
  buyInMax?: number
  gameTypes?: string[]
  formats?: string[]
  tableSizes?: number[]
  startTimeFrom?: string
  startTimeTo?: string
  sortBy?: 'date' | 'buy_in_asc' | 'buy_in_desc' | 'guarantee_desc'
  limit?: number
  offset?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tournaments?: Tournament[]
  timestamp: Date
}

// Series color mapping
export const SERIES_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  WSOP: { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'WSOP' },
  Venetian: { bg: 'bg-red-600/20', text: 'text-red-500', label: 'Venetian' },
  Wynn: { bg: 'bg-green-600/20', text: 'text-green-500', label: 'Wynn' },
  Aria: { bg: 'bg-blue-600/20', text: 'text-blue-500', label: 'Aria' },
  default: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Other' },
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts && git commit -m "feat: add TypeScript types for data model"
```

---

### Task 4: Set up Supabase clients

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`

**Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
```

**Step 3: Create admin client for seed scripts**

Create `src/lib/supabase/admin.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Step 4: Commit**

```bash
git add src/lib/supabase/ && git commit -m "feat: add Supabase client helpers (browser, server, admin)"
```

---

### Task 5: Create Supabase migration SQL

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Series table
create table series (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  venue text not null,
  start_date date not null,
  end_date date not null,
  website_url text,
  created_at timestamptz default now()
);

-- Tournaments table
create table tournaments (
  id uuid primary key default uuid_generate_v4(),
  series_id uuid references series(id) on delete cascade,
  event_number integer not null,
  name text not null,
  date date not null,
  day_of_week text not null,
  start_time time not null,
  buy_in integer not null,
  game_type text not null,
  format text not null default 'Re-entry',
  table_size integer not null default 9,
  starting_stack integer,
  blind_levels_minutes integer,
  late_reg_levels integer,
  late_reg_end_time time,
  guaranteed_prize integer,
  is_flight boolean not null default false,
  flight_label text,
  parent_event_number integer,
  estimated_duration_hours float,
  notes text,
  created_at timestamptz default now()
);

-- User preferences table
create table user_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  buy_in_min integer,
  buy_in_max integer,
  preferred_games text[] default '{}',
  preferred_formats text[] default '{}',
  preferred_start_time_earliest time,
  preferred_start_time_latest time,
  preferred_table_size integer[] default '{}',
  avoid_turbos boolean default false,
  trip_start date,
  trip_end date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- User schedule table
create table user_schedule (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tournament_id uuid references tournaments(id) on delete cascade not null,
  priority text not null default 'maybe' check (priority in ('target', 'backup', 'maybe')),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, tournament_id)
);

-- Indexes
create index idx_tournaments_date_time on tournaments(date, start_time);
create index idx_tournaments_series on tournaments(series_id);
create index idx_tournaments_buy_in on tournaments(buy_in);
create index idx_tournaments_game_type on tournaments(game_type);
create index idx_user_schedule_user on user_schedule(user_id);

-- Row Level Security
alter table series enable row level security;
alter table tournaments enable row level security;
alter table user_preferences enable row level security;
alter table user_schedule enable row level security;

-- Public read for series and tournaments
create policy "Anyone can read series" on series for select using (true);
create policy "Anyone can read tournaments" on tournaments for select using (true);

-- Authenticated users manage their own preferences
create policy "Users read own preferences" on user_preferences
  for select using (auth.uid() = user_id);
create policy "Users insert own preferences" on user_preferences
  for insert with check (auth.uid() = user_id);
create policy "Users update own preferences" on user_preferences
  for update using (auth.uid() = user_id);

-- Authenticated users manage their own schedule
create policy "Users read own schedule" on user_schedule
  for select using (auth.uid() = user_id);
create policy "Users insert own schedule" on user_schedule
  for insert with check (auth.uid() = user_id);
create policy "Users update own schedule" on user_schedule
  for update using (auth.uid() = user_id);
create policy "Users delete own schedule" on user_schedule
  for delete using (auth.uid() = user_id);

-- Service role can write series and tournaments (for admin import)
create policy "Service role writes series" on series
  for all using (auth.role() = 'service_role');
create policy "Service role writes tournaments" on tournaments
  for all using (auth.role() = 'service_role');
```

**Step 2: Commit**

```bash
git add supabase/ && git commit -m "feat: add initial database migration with RLS policies"
```

---

### Task 6: Parse WSOP PDF into seed data JSON

The WSOP PDF at `~/Downloads/WSOP Tournaments & Event Schedule | WSOP.com.pdf` contains 100 events across 18 pages. Each entry has: date, time, event number, event name (containing buy-in, game type, table size, flight info).

**Files:**
- Create: `scripts/parse-wsop-pdf.ts`
- Create: `scripts/wsop_2026_full_schedule.json` (output)

**Step 1: Install pdf-parse for the script**

```bash
cd ~/Developer/vegas-tournament-planner
npm install -D pdf-parse tsx
```

**Step 2: Write the parser script**

Create `scripts/parse-wsop-pdf.ts`. The script should:

1. Read the PDF at `~/Downloads/WSOP Tournaments & Event Schedule | WSOP.com.pdf`
2. Extract text content
3. Parse each event entry using regex patterns. Each entry in the PDF follows this format:
   ```
   May 26        Event#1
   12:00 PM      WSOP Event #1: $550 No-Limit Hold'em Mini Mystery Millions - Flight A
   ```
4. From the event name, extract:
   - `event_number`: the number after "Event #" or "Event#"
   - `buy_in`: the dollar amount (e.g., "$550" → 550, "$1,500" → 1500, "$10,000" → 10000)
   - `game_type`: map from the name:
     - "No-Limit Hold'em" / "NLH" → "NLH"
     - "Pot-Limit Omaha" / "PLO" → "PLO"
     - "Omaha Hi-Lo" → "PLO8"
     - "Seven Card Stud" → "Stud"
     - "Razz" → "Razz"
     - "2-7 Lowball Draw" / "2-7 Draw" → "2-7 Draw"
     - "Badugi" → "Badugi"
     - "HORSE" → "Mixed"
     - "TORSE" → "Mixed"
     - "Dealers Choice" / "Dealer's Choice" → "Mixed"
     - "Mixed" anything → "Mixed"
     - "Big O" → "Big O"
     - "Gladiators of Poker" → "NLH" (it's an NLH event)
   - `format`: infer from name:
     - "Mystery Bounty" → "Mystery Bounty"
     - "Bounty" → "Bounty"
     - "Freezeout" → "Freezeout"
     - "Deepstack" / "Deep Stack" → "Deepstack"
     - "Turbo" / "Super Turbo" → "Turbo"
     - "Monster Stack" → "Deepstack"
     - Default → "Re-entry"
   - `table_size`: "6-Handed" → 6, "8-Handed" → 8, "Heads Up" → 2, default → 9
   - `is_flight` / `flight_label`: "Flight A", "Flight B", etc.
   - `day_of_week`: derive from the date using `new Date()`
5. Output as JSON array matching the `tournaments` table schema (minus `id`, `series_id`, `created_at`)

**Step 3: Run the parser**

```bash
cd ~/Developer/vegas-tournament-planner
npx tsx scripts/parse-wsop-pdf.ts
```

Verify output: `scripts/wsop_2026_full_schedule.json` should contain ~160+ rows (100 unique events, some with multiple flights).

**Step 4: Manually review first 5 and last 5 entries**

Spot-check against the PDF:
- Event #1 ($550 NLH Mini Mystery Millions Flight A) on May 26 at 12:00 PM
- Event #100 ($1,000 NLH Super Turbo) on Jul 15 at 10:00 AM

**Step 5: Commit**

```bash
git add scripts/ && git commit -m "feat: add WSOP PDF parser and seed data JSON"
```

---

### Task 7: Create seed SQL from JSON

**Files:**
- Create: `scripts/generate-seed-sql.ts`
- Create: `supabase/seed.sql` (output)

**Step 1: Write the seed SQL generator**

Create `scripts/generate-seed-sql.ts`. This script:

1. Reads `scripts/wsop_2026_full_schedule.json`
2. Generates SQL that:
   - Inserts the "2026 WSOP" series row (venue: "Horseshoe & Paris Las Vegas", dates: May 26 – Jul 15, website: `https://www.wsop.com/tournaments/2026-57th-annual-world-series-of-poker/`)
   - Inserts all tournament rows referencing the series ID
3. Uses a CTE or variable for the series UUID so tournaments can reference it
4. Writes output to `supabase/seed.sql`

**Step 2: Run it**

```bash
npx tsx scripts/generate-seed-sql.ts
```

**Step 3: Verify seed.sql looks correct**

The file should start with a series INSERT, then 160+ tournament INSERTs.

**Step 4: Commit**

```bash
git add scripts/generate-seed-sql.ts supabase/seed.sql && git commit -m "feat: generate seed SQL from parsed WSOP data"
```

---

### Task 8: Build the tournaments API route

**Files:**
- Create: `src/app/api/tournaments/route.ts`
- Create: `src/lib/queries.ts`

**Step 1: Create the query builder**

Create `src/lib/queries.ts`. This module builds Supabase queries from `TournamentFilters`:

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { TournamentFilters } from '@/types'

export function buildTournamentQuery(
  supabase: SupabaseClient,
  filters: TournamentFilters
) {
  let query = supabase
    .from('tournaments')
    .select('*, series:series_id(id, name, venue)')

  if (filters.dateFrom) query = query.gte('date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('date', filters.dateTo)
  if (filters.seriesIds?.length) query = query.in('series_id', filters.seriesIds)
  if (filters.buyInMin) query = query.gte('buy_in', filters.buyInMin)
  if (filters.buyInMax) query = query.lte('buy_in', filters.buyInMax)
  if (filters.gameTypes?.length) query = query.in('game_type', filters.gameTypes)
  if (filters.formats?.length) query = query.in('format', filters.formats)
  if (filters.tableSizes?.length) query = query.in('table_size', filters.tableSizes)
  if (filters.startTimeFrom) query = query.gte('start_time', filters.startTimeFrom)
  if (filters.startTimeTo) query = query.lte('start_time', filters.startTimeTo)

  // Sorting
  switch (filters.sortBy) {
    case 'buy_in_asc':
      query = query.order('buy_in', { ascending: true })
      break
    case 'buy_in_desc':
      query = query.order('buy_in', { ascending: false })
      break
    case 'guarantee_desc':
      query = query.order('guaranteed_prize', { ascending: false, nullsFirst: false })
      break
    default:
      query = query.order('date').order('start_time')
  }

  if (filters.limit) query = query.limit(filters.limit)
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

  return query
}
```

**Step 2: Create the API route**

Create `src/app/api/tournaments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildTournamentQuery } from '@/lib/queries'
import { TournamentFilters } from '@/types'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const supabase = await createClient()

  const filters: TournamentFilters = {
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
    seriesIds: searchParams.getAll('seriesId'),
    buyInMin: searchParams.get('buyInMin') ? Number(searchParams.get('buyInMin')) : undefined,
    buyInMax: searchParams.get('buyInMax') ? Number(searchParams.get('buyInMax')) : undefined,
    gameTypes: searchParams.getAll('gameType'),
    formats: searchParams.getAll('format'),
    tableSizes: searchParams.getAll('tableSize').map(Number).filter(Boolean),
    startTimeFrom: searchParams.get('startTimeFrom') || undefined,
    startTimeTo: searchParams.get('startTimeTo') || undefined,
    sortBy: (searchParams.get('sortBy') as TournamentFilters['sortBy']) || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : 0,
  }

  const { data, error } = await buildTournamentQuery(supabase, filters)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 3: Commit**

```bash
git add src/lib/queries.ts src/app/api/tournaments/route.ts && git commit -m "feat: add tournaments API route with filter query builder"
```

---

### Task 9: Build navigation component

**Files:**
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create nav component**

Create `src/components/nav.tsx`:

A responsive navigation component:
- **Desktop** (md+): Horizontal top bar with logo "VTP" on left, links (Browse, Chat, Schedule) in center, login button on right
- **Mobile**: Fixed bottom tab bar with icons for Browse (search icon), Chat (message icon), Schedule (calendar icon), Settings (gear icon)
- Active route highlighted with green accent
- Use `usePathname()` from `next/navigation` to determine active route
- Use Lucide React icons: `Search`, `MessageSquare`, `Calendar`, `Settings`, `LogIn`

Install icons:

```bash
npm install lucide-react
```

**Step 2: Add nav to layout**

Modify `src/app/layout.tsx` to include `<Nav />` component. Desktop nav at top, mobile nav at bottom. Main content area should have `pb-16` on mobile (for bottom nav clearance) and `pt-16` on desktop (for top nav clearance).

**Step 3: Verify navigation renders**

```bash
npm run dev
```

Check both desktop and mobile viewports.

**Step 4: Commit**

```bash
git add src/components/nav.tsx src/app/layout.tsx && git commit -m "feat: add responsive navigation (top bar desktop, bottom tabs mobile)"
```

---

### Task 10: Build tournament card component

**Files:**
- Create: `src/components/tournament-card.tsx`

**Step 1: Create the tournament card**

Create `src/components/tournament-card.tsx`:

A card component that displays a single tournament. Props: `tournament: Tournament`.

Layout:
- Series color badge (top-left corner, small pill)
- Event name (bold, primary text)
- Row: Date + Day of week | Start time
- Row: Buy-in (formatted as "$1,500") | Game type badge | Format badge
- Row: Table size (e.g., "6-max") | Guarantee if available (e.g., "GTD $1M")
- Flight label if applicable (e.g., "Flight A")
- Subtle border, card background (#1a1a1a), hover state (slightly lighter)

Use the `SERIES_COLORS` map from `@/types` to color the series badge. The card should use shadcn `Card` as the base.

Format helpers needed in `src/lib/utils.ts`:
- `formatBuyIn(amount: number)`: returns "$1,500" formatted string
- `formatTime(time: string)`: returns "2:00 PM" from "14:00:00"
- `formatDate(date: string)`: returns "Jun 1" from "2026-06-01"
- `getSeriesColor(seriesName: string)`: returns the color config from SERIES_COLORS

**Step 2: Commit**

```bash
git add src/components/tournament-card.tsx src/lib/utils.ts && git commit -m "feat: add tournament card component with series color coding"
```

---

### Task 11: Build tournament filters component

**Files:**
- Create: `src/components/tournament-filters.tsx`
- Create: `src/hooks/use-tournament-filters.ts`

**Step 1: Create the filter state hook**

Create `src/hooks/use-tournament-filters.ts`:

A custom hook that:
- Reads filter state from URL search params using `useSearchParams()`
- Provides setter functions that update URL params via `useRouter().replace()`
- Returns `{ filters: TournamentFilters, setFilter, resetFilters, filterCount }`
- Debounces URL updates by 300ms for slider inputs

**Step 2: Create the filters component**

Create `src/components/tournament-filters.tsx`:

Props: `{ filters, setFilter, resetFilters, filterCount, series: Series[] }`

**Desktop layout** (sidebar, visible on md+):
- Vertical stack of filter sections, each with a header label
- "Clear all" button at top when any filters are active

**Mobile layout** (sheet, hidden on md+):
- A `Sheet` (shadcn) triggered by a button showing filter count badge
- Same filter sections inside the sheet

**Filter sections:**

1. **Date**: Row of quick-pick buttons ("Today", "Tomorrow", "This Week") + a date range input (two date inputs). Quick picks set `dateFrom` and `dateTo`.

2. **Series**: Multi-select badges/chips for each series. Each chip shows the series color. Toggle on/off.

3. **Buy-in**: Two number inputs (min and max) with preset quick picks ($0–$600, $0–$1,500, $0–$5,000, Any).

4. **Game Type**: Multi-select badges for: NLH, PLO, PLO8, Mixed, Stud, Razz, 2-7 Draw, Badugi, Big O. Toggle on/off.

5. **Format**: Multi-select badges for: Freezeout, Re-entry, Bounty, Mystery Bounty, Deepstack, Turbo. Toggle on/off.

6. **Table Size**: Toggle group: 6-max, 8-handed, Full Ring, Any.

7. **Sort**: Dropdown select: Date/Time (default), Buy-in (low→high), Buy-in (high→low), Guarantee (high→low).

**Step 3: Commit**

```bash
git add src/components/tournament-filters.tsx src/hooks/use-tournament-filters.ts && git commit -m "feat: add tournament filter component with URL param sync"
```

---

### Task 12: Build the browse page

**Files:**
- Create: `src/app/browse/page.tsx`
- Create: `src/hooks/use-tournaments.ts`

**Step 1: Create the data fetching hook**

Create `src/hooks/use-tournaments.ts`:

A hook that:
- Takes `TournamentFilters` as input
- Fetches from `/api/tournaments` with the filters as query params
- Uses `useEffect` + `useState` (or SWR if you prefer, but keep it simple)
- Returns `{ tournaments: Tournament[], loading: boolean, error: string | null }`
- Refetches when filters change

**Step 2: Create the browse page**

Create `src/app/browse/page.tsx` (client component with `'use client'`):

Layout:
- **Desktop**: Two-column layout. Left sidebar (280px) for filters. Right main area for results.
- **Mobile**: Full-width results. Filter button (floating or top bar) opens the filter sheet.

Content:
- Header: "Tournament Browser" + result count + view toggle (card/table)
- Results area:
  - Card view (default): responsive grid of `TournamentCard` components. 1 column on mobile, 2 on desktop.
  - Loading state: skeleton cards (4-6 placeholder cards with animated pulse)
  - Empty state: "No tournaments match your filters" with a "Reset filters" button
  - Error state: "Something went wrong" with retry button
- Pagination: "Load more" button at bottom (increment offset by 50)

Each tournament card should link to `/tournament/[id]` (we'll build that page later, just wire the link now).

**Step 3: Create a minimal landing page redirect**

Update `src/app/page.tsx` to redirect to `/browse` for now (we'll build the real landing page later):

```typescript
import { redirect } from 'next/navigation'
export default function Home() { redirect('/browse') }
```

**Step 4: Verify the browse page renders**

```bash
npm run dev
```

Visit http://localhost:3000/browse. Without Supabase configured, it should show the empty state gracefully (not crash). The filters should render and be interactive.

**Step 5: Commit**

```bash
git add src/app/browse/ src/app/page.tsx src/hooks/use-tournaments.ts && git commit -m "feat: add tournament browse page with filters and card grid"
```

---

### Task 13: Build tournament detail page

**Files:**
- Create: `src/app/tournament/[id]/page.tsx`

**Step 1: Create the detail page**

Create `src/app/tournament/[id]/page.tsx` (server component):

Fetches the tournament by ID from Supabase (with series join). Displays:
- Back button (← Browse)
- Series badge (colored)
- Event name (large heading)
- Date, day of week, start time
- Buy-in (large, prominent)
- Game type + Format + Table size badges
- Starting stack (if available, else "TBD")
- Blind levels (if available)
- Late reg info: "Late registration open for X levels" + computed end time
- Guarantee (if available)
- Flight info (if applicable): "This is Flight A of Event #18"
- Notes (if any)
- "Add to Schedule" button (disabled for now — wired in Layer 3)

If tournament not found, show 404 with `notFound()`.

**Step 2: Commit**

```bash
git add src/app/tournament/ && git commit -m "feat: add tournament detail page"
```

---

### Task 14: Build landing page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace redirect with real landing page**

Update `src/app/page.tsx`:

A simple, compelling landing page:
- Hero section: "Plan Your Vegas Tournament Schedule" heading, "AI-powered tournament planning for Las Vegas poker festivals" subheading
- Quick-start row: "Today's Tournaments" / "This Week" / "Browse All" buttons that link to `/browse` with the appropriate date filters
- Active series section: Cards showing each series (just WSOP for now) with date range, venue, event count
- "Chat with AI" call-to-action: "Ask our AI planner to build your perfect schedule" button linking to `/chat`
- Footer: minimal, just "Vegas Tournament Planner" + year

Dark theme, poker green accents, clean and modern.

**Step 2: Commit**

```bash
git add src/app/page.tsx && git commit -m "feat: add landing page with quick-start actions"
```

---

## Layer 2: AI Chat

### Task 15: Build Claude tool definitions and system prompt

**Files:**
- Create: `src/lib/claude.ts`

**Step 1: Create the Claude configuration module**

Create `src/lib/claude.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const CHAT_MODEL = 'claude-sonnet-4-20250514'

export function buildSystemPrompt(currentTime: string, userPreferences?: any) {
  return `You are the Vegas Tournament Planner AI assistant. You help poker players find and plan tournaments across Las Vegas poker festivals.

Current date and time (PDT): ${currentTime}

You have access to a database of poker tournaments. Use the search_tournaments tool to find tournaments matching the user's criteria. When displaying results, be concise and highlight the key details: event name, date/time, buy-in, game type, and format.

${userPreferences ? `
The user has saved these preferences:
- Buy-in range: $${userPreferences.buy_in_min || 0} - $${userPreferences.buy_in_max || 'any'}
- Preferred games: ${userPreferences.preferred_games?.join(', ') || 'any'}
- Preferred formats: ${userPreferences.preferred_formats?.join(', ') || 'any'}
- Avoids turbos: ${userPreferences.avoid_turbos ? 'yes' : 'no'}
- Trip dates: ${userPreferences.trip_start || 'not set'} to ${userPreferences.trip_end || 'not set'}

Use these as defaults when the user doesn't specify, but always respect explicit overrides in their message.
` : ''}

Guidelines:
- Be helpful, concise, and knowledgeable about poker tournament strategy
- When suggesting tournaments, consider time conflicts with the user's existing schedule
- For "what can I late-reg?" queries, check the current time against late_reg_end_time
- Format buy-ins with dollar signs and commas (e.g., "$1,500")
- Format times in 12-hour format (e.g., "2:00 PM")
- If no tournaments match, suggest alternatives or broadening criteria
- You can suggest adding tournaments to the user's schedule using the add_to_schedule tool`
}

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'search_tournaments',
    description: 'Search the tournament database with optional filters. Returns tournaments matching all specified criteria. Omit a filter to not restrict on that dimension.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        buy_in_min: { type: 'number', description: 'Minimum buy-in in dollars' },
        buy_in_max: { type: 'number', description: 'Maximum buy-in in dollars' },
        game_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Game types to include: NLH, PLO, PLO8, Mixed, Stud, Razz, 2-7 Draw, Badugi, Big O'
        },
        formats: {
          type: 'array',
          items: { type: 'string' },
          description: 'Formats to include: Freezeout, Re-entry, Bounty, Mystery Bounty, Deepstack, Turbo'
        },
        table_sizes: {
          type: 'array',
          items: { type: 'number' },
          description: 'Table sizes: 2 (heads up), 6 (6-max), 8 (8-handed), 9 (full ring)'
        },
        start_time_from: { type: 'string', description: 'Earliest start time (HH:MM, 24h)' },
        start_time_to: { type: 'string', description: 'Latest start time (HH:MM, 24h)' },
        sort_by: {
          type: 'string',
          enum: ['date', 'buy_in_asc', 'buy_in_desc', 'guarantee_desc'],
          description: 'Sort order (default: date)'
        },
        limit: { type: 'number', description: 'Max results to return (default: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_user_schedule',
    description: 'Get the current user\'s saved tournament schedule with priorities and notes.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'add_to_schedule',
    description: 'Add a tournament to the user\'s schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tournament_id: { type: 'string', description: 'UUID of the tournament' },
        priority: {
          type: 'string',
          enum: ['target', 'backup', 'maybe'],
          description: 'Priority level'
        },
        notes: { type: 'string', description: 'Optional personal notes' },
      },
      required: ['tournament_id', 'priority'],
    },
  },
  {
    name: 'get_current_time',
    description: 'Get the current date and time in PDT (Las Vegas time). Use this for "what\'s available right now" or "can I still late-reg" queries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]
```

**Step 2: Commit**

```bash
git add src/lib/claude.ts && git commit -m "feat: add Claude config with system prompt and tool definitions"
```

---

### Task 16: Build the chat API route

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Create the chat API route**

Create `src/app/api/chat/route.ts`:

This is the core AI endpoint. It:

1. Receives POST with `{ messages: Array<{role, content}>, userId?: string }`
2. Creates a Supabase server client
3. If `userId` is provided, fetches user preferences and schedule
4. Builds the system prompt with current PDT time and preferences
5. Calls Claude API with streaming, tools enabled
6. Handles tool calls in a loop:
   - `search_tournaments`: builds and executes a Supabase query using `buildTournamentQuery`
   - `get_user_schedule`: queries `user_schedule` joined with `tournaments` for the user
   - `add_to_schedule`: inserts into `user_schedule` (requires auth)
   - `get_current_time`: returns `new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })`
7. After tool results are processed, sends Claude's final response
8. Returns a streaming response using `ReadableStream` so the frontend can display tokens as they arrive

Key implementation detail: The tool-use loop. Claude may call one or more tools. After each round of tool calls:
- Execute all tool calls
- Send results back to Claude as `tool_result` messages
- Continue until Claude produces a text response (no more tool calls)

Use the Anthropic SDK's streaming API:

```typescript
const stream = await anthropic.messages.stream({
  model: CHAT_MODEL,
  max_tokens: 4096,
  system: systemPrompt,
  tools: TOOL_DEFINITIONS,
  messages: conversationMessages,
})
```

For the streaming response to the client, use a `TransformStream` that forwards text deltas. When tool calls happen, handle them server-side (don't stream tool call internals to the client). After tool results come back, continue the stream.

The response format to the client should be a stream of JSON objects:
```
{"type":"text","content":"Here are "}
{"type":"text","content":"today's tournaments..."}
{"type":"tournaments","data":[...array of tournament objects...]}
{"type":"done"}
```

This allows the frontend to render text progressively AND display tournament cards inline.

**Step 2: Commit**

```bash
git add src/app/api/chat/route.ts && git commit -m "feat: add chat API route with Claude streaming and tool execution"
```

---

### Task 17: Build the chat interface component

**Files:**
- Create: `src/components/chat-interface.tsx`
- Create: `src/components/chat-message.tsx`
- Create: `src/hooks/use-chat.ts`

**Step 1: Create the chat state hook**

Create `src/hooks/use-chat.ts`:

A custom hook that:
- Maintains `messages: ChatMessage[]` in state
- `sendMessage(content: string)`:
  1. Appends user message to state
  2. Appends empty assistant message (for streaming)
  3. POSTs to `/api/chat` with full message history
  4. Reads the streaming response line by line
  5. For `"text"` chunks: appends to the current assistant message content
  6. For `"tournaments"` chunks: attaches tournament data to the current assistant message
  7. For `"done"`: marks message as complete
- `isLoading: boolean` — true while streaming
- `error: string | null`

**Step 2: Create the chat message component**

Create `src/components/chat-message.tsx`:

Renders a single `ChatMessage`:
- User messages: right-aligned, green-tinted background
- Assistant messages: left-aligned, card background (#1a1a1a)
- If `message.tournaments` has data, render tournament cards inline (smaller, compact variant of `TournamentCard`)
- Markdown rendering for assistant text (use a simple approach — split by \n, bold with **, etc. Don't install a full markdown library for MVP.)

**Step 3: Create the chat interface**

Create `src/components/chat-interface.tsx`:

Full-height chat layout:
- Scrollable message area (takes all available space)
- Auto-scrolls to bottom on new messages
- Fixed input bar at bottom: text input + send button
- Send on Enter (not Shift+Enter), Shift+Enter for newline
- Typing indicator when `isLoading` (three animated dots)
- Suggested prompts shown when chat is empty:
  - "Plan my day — NLH and PLO, under $1,500"
  - "What's running this Saturday?"
  - "Best deepstack events this week?"
  - "Compare the $600 PLO events"

**Step 4: Commit**

```bash
git add src/components/chat-interface.tsx src/components/chat-message.tsx src/hooks/use-chat.ts && git commit -m "feat: add chat interface with streaming message display"
```

---

### Task 18: Build the chat page

**Files:**
- Create: `src/app/chat/page.tsx`

**Step 1: Create the chat page**

Create `src/app/chat/page.tsx` (client component):

Simple wrapper:
- Full viewport height (minus nav)
- Renders `<ChatInterface />`
- No sidebar or extra chrome — the chat IS the page

**Step 2: Verify the chat page**

```bash
npm run dev
```

Visit http://localhost:3000/chat. The UI should render with suggested prompts. Without the Anthropic API key configured, sending a message should show an error gracefully.

**Step 3: Commit**

```bash
git add src/app/chat/ && git commit -m "feat: add AI chat planner page"
```

---

## Layer 3: Auth + Personalization

### Task 19: Set up Supabase Auth

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Create: `src/middleware.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/hooks/use-user.ts`

**Step 1: Create auth callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

**Step 2: Create Supabase middleware helper**

Create `src/lib/supabase/middleware.ts` — the standard Supabase SSR middleware that refreshes auth tokens on each request.

**Step 3: Create Next.js middleware**

Create `src/middleware.ts` that:
- Runs the Supabase middleware helper on every request
- Does NOT block any routes (anonymous access is allowed everywhere)
- Just ensures the auth session is refreshed

**Step 4: Create useUser hook**

Create `src/hooks/use-user.ts`:

```typescript
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
```

**Step 5: Commit**

```bash
git add src/app/auth/ src/middleware.ts src/lib/supabase/middleware.ts src/hooks/use-user.ts && git commit -m "feat: set up Supabase auth with middleware and useUser hook"
```

---

### Task 20: Build login page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Create the login page**

Create `src/app/login/page.tsx`:

A centered card with:
- "Sign in to Vegas Tournament Planner" heading
- Email + password form (Supabase `signInWithPassword`)
- "Create account" toggle that switches to `signUp`
- "Sign in with Google" button (Supabase `signInWithOAuth({ provider: 'google' })`)
- Divider between email and Google auth
- Error message display
- Redirect to `?next=` param after login (default to `/`)
- If already logged in, redirect away

**Step 2: Update nav to show user state**

Modify `src/components/nav.tsx`:
- Use `useUser()` hook
- If logged in: show user avatar/initial + dropdown with "Settings", "My Schedule", "Sign Out"
- If not logged in: show "Sign In" button linking to `/login`

**Step 3: Commit**

```bash
git add src/app/login/ src/components/nav.tsx && git commit -m "feat: add login page with email and Google OAuth"
```

---

### Task 21: Build user preferences page and API

**Files:**
- Create: `src/app/settings/page.tsx`
- Create: `src/app/api/preferences/route.ts`

**Step 1: Create preferences API route**

Create `src/app/api/preferences/route.ts`:

- `GET`: Fetch current user's preferences from `user_preferences` table. Returns 401 if not authenticated.
- `PUT`: Upsert preferences for the current user. Validates the body. Returns the updated row.

**Step 2: Create settings page**

Create `src/app/settings/page.tsx` (client component):

A form matching the `user_preferences` schema:
- Buy-in range: two number inputs (min, max)
- Preferred games: multi-select badges (same as browse filter)
- Preferred formats: multi-select badges
- Earliest/latest start time: two time inputs
- Preferred table sizes: toggle group
- Avoid turbos: checkbox/switch
- Trip dates: two date inputs (start, end)
- Save button
- Loading state while fetching existing preferences
- Success toast on save

Redirects to `/login?next=/settings` if not authenticated.

**Step 3: Commit**

```bash
git add src/app/settings/ src/app/api/preferences/ && git commit -m "feat: add user preferences settings page and API"
```

---

### Task 22: Build schedule API routes

**Files:**
- Create: `src/app/api/schedule/route.ts`
- Create: `src/app/api/schedule/export/route.ts`

**Step 1: Create schedule CRUD API**

Create `src/app/api/schedule/route.ts`:

- `GET`: Fetch user's schedule entries joined with tournament + series data. Ordered by tournament date/time. Returns 401 if not authenticated.
- `POST`: Add a tournament to schedule. Body: `{ tournament_id, priority, notes? }`. Returns 401 if not auth. Returns 409 if already in schedule.
- `DELETE`: Remove from schedule. Query param: `id` (schedule entry ID). Returns 401 if not auth.
- `PATCH`: Update priority or notes. Body: `{ id, priority?, notes? }`. Returns 401 if not auth.

**Step 2: Create ICS export API**

Create `src/app/api/schedule/export/route.ts`:

- `GET`: Generates an ICS calendar file from the user's schedule.
- Builds VCALENDAR with VEVENT entries for each scheduled tournament.
- Each VEVENT:
  - DTSTART: tournament date + start_time (PDT timezone)
  - DTEND: DTSTART + estimated_duration_hours (default 10 hours if not set)
  - SUMMARY: event name
  - DESCRIPTION: buy-in, game type, format, series, priority, user notes
  - LOCATION: series venue
- Returns with headers: `Content-Type: text/calendar`, `Content-Disposition: attachment; filename=vegas-schedule.ics`
- No external library needed — ICS format is simple text.

**Step 3: Commit**

```bash
git add src/app/api/schedule/ && git commit -m "feat: add schedule CRUD API and ICS export"
```

---

### Task 23: Build schedule page

**Files:**
- Create: `src/app/schedule/page.tsx`
- Create: `src/components/schedule-view.tsx`
- Create: `src/hooks/use-schedule.ts`

**Step 1: Create schedule data hook**

Create `src/hooks/use-schedule.ts`:

- Fetches from `/api/schedule`
- Returns `{ entries, loading, error, addToSchedule, removeFromSchedule, updateEntry, refetch }`
- `addToSchedule(tournamentId, priority, notes?)` — POST + refetch
- `removeFromSchedule(entryId)` — DELETE + refetch
- `updateEntry(entryId, { priority?, notes? })` — PATCH + refetch

**Step 2: Create schedule view component**

Create `src/components/schedule-view.tsx`:

A list view (calendar view deferred to v2) showing:
- Entries grouped by date
- Each entry shows: tournament card (compact) + priority badge (green/yellow/gray) + notes
- Priority dropdown to change priority inline
- Delete button (with confirmation)
- Conflict detection: if two entries on the same date have overlapping times (start_time + estimated_duration), highlight both in red with a "Conflict" badge
- Empty state: "No tournaments in your schedule yet. Browse tournaments to get started." with link to `/browse`

**Step 3: Create schedule page**

Create `src/app/schedule/page.tsx` (client component):

- Header: "My Schedule" + entry count + "Export to Calendar" button
- Export button calls `/api/schedule/export` and triggers file download
- Renders `<ScheduleView />`
- If not authenticated, show a card: "Sign in to save your tournament schedule" with login link

**Step 4: Commit**

```bash
git add src/app/schedule/ src/components/schedule-view.tsx src/hooks/use-schedule.ts && git commit -m "feat: add personal schedule page with conflict detection and ICS export"
```

---

### Task 24: Wire "Add to Schedule" across the app

**Files:**
- Modify: `src/components/tournament-card.tsx`
- Modify: `src/app/tournament/[id]/page.tsx`
- Modify: `src/components/chat-message.tsx`

**Step 1: Add schedule button to tournament card**

Modify `src/components/tournament-card.tsx`:
- Add an optional `onAddToSchedule?: (tournamentId: string) => void` prop
- Show a small "+" button on the card. On click, show a dropdown with priority options (Target, Backup, Maybe).
- If not logged in (check with `useUser()`), clicking shows a toast: "Sign in to save tournaments" with a link to login.

**Step 2: Wire tournament detail page**

Modify `src/app/tournament/[id]/page.tsx`:
- Convert to client component (or add a client wrapper) to use `useSchedule()` and `useUser()`
- Enable the "Add to Schedule" button
- Show current schedule status if already added ("In your schedule as Target")
- Allow removing from schedule

**Step 3: Wire chat tournament cards**

Modify `src/components/chat-message.tsx`:
- Tournament cards in chat messages get the same "Add to Schedule" functionality

**Step 4: Commit**

```bash
git add src/components/tournament-card.tsx src/app/tournament/ src/components/chat-message.tsx && git commit -m "feat: wire Add to Schedule across browse, detail, and chat"
```

---

## Layer 4: Admin

### Task 25: Build admin import page

**Files:**
- Create: `src/app/admin/import/page.tsx`
- Create: `src/app/api/admin/import/route.ts`

**Step 1: Create import API route**

Create `src/app/api/admin/import/route.ts`:

- `POST`: Accepts `{ format: 'json' | 'csv', data: string, series_id: string }`
- Requires service role key (check `SUPABASE_SERVICE_ROLE_KEY` matches a header, or check that user is an admin — for MVP, a simple env var `ADMIN_EMAILS` list is sufficient)
- Parses the data:
  - JSON: expects array of tournament objects
  - CSV: parses with headers matching tournament columns
- Validates each row: required fields (name, date, start_time, buy_in, game_type)
- Duplicate detection: checks for existing rows with same (series_id, event_number, date, flight_label)
- Returns `{ inserted: number, skipped: number, errors: string[] }`
- Uses Supabase admin client for the insert (bypasses RLS)

**Step 2: Create import page**

Create `src/app/admin/import/page.tsx` (client component):

- Password/email gate: only accessible if user email is in `ADMIN_EMAILS` env var. Show "Access denied" otherwise.
- Series selector: dropdown of existing series + "Create new series" option
- If "Create new series": inline form for name, venue, dates, website URL
- Format toggle: JSON / CSV
- Textarea for pasting data (large, monospace font)
- "Preview" button: parses the data client-side and shows a table of the first 10 rows
- "Import" button: sends to API, shows progress, displays results (inserted/skipped/errors)
- Sample format hint: show an example JSON object and CSV row

**Step 3: Commit**

```bash
git add src/app/admin/ src/app/api/admin/ && git commit -m "feat: add admin import page for CSV/JSON tournament data"
```

---

## Final Tasks

### Task 26: Polish and error boundaries

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/browse/loading.tsx`
- Create: `src/app/chat/loading.tsx`

**Step 1: Create global error boundary**

Create `src/app/error.tsx` (client component):
- Friendly error message: "Something went wrong"
- "Try again" button that calls `reset()`
- Dark themed

**Step 2: Create 404 page**

Create `src/app/not-found.tsx`:
- "Page not found" with a link back to home

**Step 3: Create loading states**

Create `src/app/browse/loading.tsx`:
- Skeleton grid of 6 tournament cards (pulse animation)

Create `src/app/chat/loading.tsx`:
- Skeleton chat interface with placeholder messages

**Step 4: Commit**

```bash
git add src/app/error.tsx src/app/not-found.tsx src/app/browse/loading.tsx src/app/chat/loading.tsx && git commit -m "feat: add error boundaries and loading states"
```

---

### Task 27: Final verification and cleanup

**Step 1: Run linter**

```bash
cd ~/Developer/vegas-tournament-planner && npm run lint
```

Fix any linting errors.

**Step 2: Run build**

```bash
npm run build
```

Fix any TypeScript errors.

**Step 3: Manual smoke test**

With `npm run dev`:
1. Landing page loads ✓
2. Browse page shows filters (may be empty without Supabase) ✓
3. Chat page loads with suggested prompts ✓
4. Schedule page shows auth prompt when not logged in ✓
5. Admin import page renders ✓
6. Navigation works on mobile and desktop ✓
7. Dark theme throughout ✓

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: fix lint and build errors"
```

---

## Post-Build: Connect Supabase

These steps are done manually after Supabase is configured:

1. Create a Supabase project (or use existing)
2. Run the migration SQL in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL editor
3. Run the seed SQL in `supabase/seed.sql` via the SQL editor
4. Copy the Supabase URL and keys to `.env.local`
5. Add the Anthropic API key to `.env.local`
6. Configure Google OAuth in Supabase dashboard (optional for MVP)
7. Set `ADMIN_EMAILS` in `.env.local`
8. Restart the dev server and verify data loads

---

## Summary

| Layer | Tasks | What ships |
|-------|-------|-----------|
| 1: Data + Browse | Tasks 1–14 | Project scaffold, dark theme, types, Supabase clients, DB schema, seed data, tournaments API, nav, tournament cards, filters, browse page, detail page, landing page |
| 2: AI Chat | Tasks 15–18 | Claude config + tools, chat API with streaming, chat UI, chat page |
| 3: Auth + Personalization | Tasks 19–24 | Supabase Auth, login page, preferences, schedule API + UI, ICS export, "Add to Schedule" wiring |
| 4: Admin | Task 25 | CSV/JSON import page + API |
| Polish | Tasks 26–27 | Error boundaries, loading states, lint/build cleanup |
