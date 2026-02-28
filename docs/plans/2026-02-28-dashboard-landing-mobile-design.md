# Dashboard Polish, SEO Landing Page & Mobile UX — Design Doc

**Date:** 2026-02-28

## 1. SEO Landing Page (non-logged-in visitors)

### Goal
Replace the dashboard at `/` with a marketing landing page for unauthenticated visitors. Improves SEO, gives Google content to index, and provides a clear conversion funnel.

### Sections
1. **Hero** — Bold headline ("Plan Your Vegas Poker Trip"), subtitle explaining NextRebuy, "Get Started Free" CTA, screenshot/mockup of the schedule view
2. **Feature Cards** (3-4 grid) — Browse tournaments, Build your schedule, Track results, AI Advisor. Each with icon, title, short description.
3. **How It Works** — 3-step flow: Browse → Schedule → Play
4. **Live Stats Bar** — Real numbers from DB: tournament count, series count. Shows the database is active.
5. **Final CTA** — "Start planning your trip" with sign-up button

### Technical
- `page.tsx` checks auth server-side via `createClient()` + `getUser()`
- If no user → render `LandingPage` component
- If logged in → render `Dashboard` component (the polished version)
- Landing page is a server component with semantic HTML (`h1`, `h2`, proper meta)
- SEO metadata: title, description, og tags optimized for "Vegas poker tournament planner"

## 2. Dashboard Polish (logged-in homepage)

### Goal
Transform the dashboard from a generic tournament browser into a trip-focused command center.

### New Layout (top to bottom)
1. **Trip Countdown Card** — "Your Vegas Trip in X days" with arrival/departure dates. States: no trip configured (CTA to settings), trip upcoming (countdown), trip in progress ("Day X of Y"), trip completed (summary).
2. **Today's Schedule** — User's scheduled tournaments for today only (not all tournaments). Shows time, venue, buy-in, Log Result button. Empty state: "No tournaments today."
3. **Trip Stats Row** (3 cards) — Budget remaining, Tournaments scheduled, Net P&L. Color-coded values.
4. **This Week's Schedule** — User's upcoming scheduled tournaments for next 7 days, grouped by day.
5. **Quick Actions** — Browse, AI Advisor, Trip Planner links (moved below personal content).

### Data Requirements
- User preferences (trip dates, budget) via `/api/preferences`
- User's schedule entries via `/api/schedule`
- User's results via `/api/results`
- Dashboard becomes a client component (needs auth context for personal data)

### Fallback States
- No trip dates → "Set up your trip" card with link to Settings
- No scheduled tournaments → "Your schedule is empty" with link to Browse
- No results logged → Trip Stats shows P&L as "--"

## 3. Mobile UX Pass

### Goal
Tighten spacing, touch targets, and readability on mobile. No new features or layout changes.

### Changes
- **Touch targets** — All buttons/interactive elements minimum 44x44px. Audit: tournament cards, filter pills, sidebar nav items, bottom nav icons.
- **Card spacing** — Increase `space-y-3` to `space-y-4` on mobile for breathing room. Larger padding inside cards on small screens.
- **Text sizing** — Bump `text-xs` metadata labels to `text-sm` on mobile where readability suffers.
- **Bottom nav safe area** — Add `pb-safe` or env(safe-area-inset-bottom) for gesture bar phones.
- **Tournament cards** — Make full card tappable on mobile via wrapping Link.
- **Form inputs** — Set inputs to `text-base` (16px) to prevent iOS auto-zoom on focus.

### Files to Audit
- `src/components/tournament-card.tsx`
- `src/components/mobile-bottom-nav.tsx`
- `src/components/dashboard-shell.tsx`
- `src/app/browse/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/login/page.tsx`
- `src/app/schedule/page.tsx`

## Implementation Order
1. SEO Landing Page (highest impact for AdSense + organic traffic)
2. Dashboard Polish (improves logged-in experience)
3. Mobile UX Pass (refinement layer)
