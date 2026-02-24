# NextRebuy Product Roadmap

> **Purpose:** Feature backlog and monetization plan for NextRebuy (vegas-tournament-planner).
> Features are ordered by implementation priority within each tier.

---

## Free Tier Improvements

### 1. Tournament Notes & Results Logging
After a tournament, let users log their result (finish position, payout, bust hand). Builds engagement and feeds into Pro analytics later.

- Add `result_place`, `result_payout`, `result_notes` columns to `user_schedule`
- Post-tournament card state with result entry form
- Simple "My Results" history view on the schedule page

### 2. Push Notifications & Schedule Alerts
Remind users 30/60 min before a saved tournament starts, and alert when a tournament they're tracking gets cancelled or modified.

- Implement with web push notifications (Service Worker + Push API)
- Leverage the existing Resend integration for email fallback
- The cron monitor route (`/api/cron/monitor-schedules`) is already stubbed out — flesh it out to diff tournament data and trigger alerts

### 3. Social Schedule Sharing
Let users generate a shareable link to their tournament schedule (read-only public view). Great for coordinating with poker friends traveling together.

- New `user_schedule_shares` table with a unique slug
- Public route `/s/[slug]` renders a read-only calendar
- Toggle in schedule page: "Share my schedule"

### 4. Infinite Scroll & Performance
The browse page currently hard-caps at 50 results. Add infinite scroll for smoother browsing of large result sets.

- Implement cursor-based pagination in the tournaments API
- `useInfiniteQuery`-style hook or intersection observer trigger
- Skeleton loading states for new pages

### 5. Similar Tournaments & Quick Compare
When viewing a tournament detail page, show "Similar tournaments" (same day, similar buy-in, same game type). Let users compare 2-3 side by side.

- Query for tournaments matching 2+ attributes of the current one
- "Compare" checkbox on cards, opens a comparison drawer/modal
- Side-by-side stat comparison (buy-in, structure, guarantee, duration)

### 6. Favorites / Watchlist
Separate concept from the schedule — "I'm interested but not committed." Lower friction than adding to schedule with a priority.

- Heart/star icon on tournament cards (persisted to `user_favorites` table)
- "Favorites" tab on the schedule page alongside calendar views
- Move from favorites to schedule with one click

---

## Pro Tier Features

### 7. Bankroll & Trip Budget Tracker (Pro)
Set a trip bankroll, track buy-ins from saved tournaments, see remaining budget in real-time. Poker players obsess over bankroll management.

- New `bankroll_sessions` table tracking deposits, buy-ins, cashes
- Dashboard widget showing: total invested, total cashed, net P&L, remaining bankroll
- Visual burn-down chart of bankroll over the trip

### 8. Smart Schedule Optimizer (Pro)
AI-powered schedule builder that takes your preferences, bankroll, and available dates, then generates an optimal tournament slate — maximizing value (overlay potential, $/EV) while avoiding conflicts.

- Extend the Claude chat tool-use with a `build_optimal_schedule` tool
- Factor in: buy-in budget, preferred games, time gaps between tournaments, guaranteed prize pools
- Present 2-3 schedule options (aggressive / balanced / conservative)

### 9. Advanced Analytics Dashboard (Pro)
ROI tracking across trips, game-type performance breakdown, casino-by-casino results, buy-in tier analysis.

- Aggregate data from results logging (feature #1)
- Charts: ROI by game type, ROI by buy-in tier, results timeline
- Use a lightweight chart library (Recharts — already React-based)
- Lifetime stats: tournaments played, total invested, total cashed, ITM%

### 10. Real-Time Late Reg Countdown (Pro)
Live countdown timers for late registration windows. When you're at a casino deciding whether to jump in, see exactly how much time you have.

- Calculate late-reg end times from existing `late_reg_levels` + `blind_levels_minutes` data
- Real-time countdown component with push notification when window is closing
- "Starting now" / "Late reg open" badges on browse cards

### 11. Multi-Trip Planning & History (Pro)
Plan multiple trips (WSOP summer, Venetian fall series, etc.) and keep historical trip data. Compare trip performance year over year.

- New `trips` table: name, start_date, end_date, bankroll, notes
- Schedule entries linked to a trip
- Trip comparison dashboard
- "Plan Next Trip" wizard

### 12. Custom Tournament Import (Pro)
Let users manually add tournaments from any venue — home games, local cardrooms, other cities. Makes the app useful year-round, not just during Vegas trips.

- "Add Custom Tournament" form
- Custom series creation for local cardrooms
- Extends the app's utility from seasonal to year-round

### 13. PDF Trip Itinerary Export (Pro)
Generate a polished PDF with your full trip schedule, venue addresses, buy-in totals, and daily breakdown. Perfect for printing or sharing with travel companions.

- Server-side PDF generation with `@react-pdf/renderer` or puppeteer
- Branded layout with series colors, daily timeline, budget summary
- API route: `/api/schedule/export-pdf`

---

## Monetization: Stripe + Supabase

### Architecture

```
User clicks "Upgrade" -> Stripe Checkout
Stripe webhook -> Supabase `subscriptions` table
Supabase RLS checks subscription status
Pro features gated client + server side
```

### Implementation Steps

1. **Stripe Integration**
   - Create Stripe account, define product ("NextRebuy Pro")
   - Add `stripe` and `@stripe/stripe-js` packages
   - `/api/stripe/checkout` — generates a Checkout Session
   - `/api/stripe/webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

2. **Supabase Schema**
   ```sql
   CREATE TABLE subscriptions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
     stripe_customer_id TEXT,
     stripe_subscription_id TEXT,
     plan TEXT DEFAULT 'free',
     status TEXT DEFAULT 'inactive',
     current_period_end TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

3. **Client-Side Gating**
   - `useSubscription()` hook that fetches plan status
   - `<ProGate>` wrapper component that shows upgrade prompt for free users
   - Pro badge in navigation for subscribed users

4. **Server-Side Gating**
   - Middleware or per-route check: query `subscriptions` table before returning Pro data
   - RLS policies on analytics/bankroll tables restricted to Pro users

### Pricing

| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 | Browse, filter, basic schedule, 5 AI chats/day |
| Pro Monthly | $9.99/mo | Full access, cancel anytime |
| Pro Season Pass | $29.99/season | ~3 months covering a festival series (best value) |
| Pro Annual | $59.99/yr | For year-round grinders |

### Free vs. Pro Feature Matrix

| Feature | Free | Pro |
|---------|------|-----|
| Browse & filter tournaments | Yes | Yes |
| Save to schedule (up to 20) | Yes | Unlimited |
| Calendar views | Yes | Yes |
| AI Advisor (5 chats/day) | Yes | Unlimited |
| Results logging | Yes | Yes |
| Push notifications | Yes | Yes |
| Schedule sharing | Yes | Yes |
| Favorites / Watchlist | Yes | Yes |
| Bankroll tracker | — | Yes |
| Smart schedule optimizer | — | Yes |
| Analytics dashboard | — | Yes |
| Late reg countdowns | — | Yes |
| Multi-trip planning | — | Yes |
| Custom tournament import | — | Yes |
| PDF export | — | Yes |
