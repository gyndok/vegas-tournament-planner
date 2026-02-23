# Schedule Calendar View Design

**Date:** 2026-02-23
**Status:** Approved

## Overview

Replace the list-only My Schedule page with a Google Calendar-style view supporting Month, Week, Day, and List modes. Built from scratch with CSS Grid — no external calendar libraries.

Also: filter out past tournaments from the browse page.

## View Modes & Navigation

**Header bar:**
- View mode toggle: Month | Week | Day | List (List hidden on mobile)
- Navigation: ← Today → (previous, jump to today, next)
- Current period label: "June 2026" / "Jun 1-7, 2026" / "Thursday, Jun 4, 2026"
- Export .ics button (unchanged)

**Default view:** Week

## Month View

- 7-column CSS Grid (Sun–Sat)
- Date number in each cell
- Tournament events as small colored pills: time + truncated name
- Priority color-coded: blue (Target), yellow (Backup), gray (Maybe)
- "+N more" if >2-3 events per cell, click switches to Day view
- Days outside current month dimmed
- Click day number → Day view

## Week View

- 7-column grid with time axis on left (8am–midnight)
- Events positioned vertically by start time, height proportional to estimated duration
- Priority color-coded blocks: time, tournament name
- Overlapping events shown side by side (conflicts visually obvious)
- Current time indicator (red horizontal line) if viewing current week

## Day View

- Single column with time axis (8am–midnight)
- Larger event blocks: name, buy-in, game type, format
- Priority color, conflict indicators

## List View (tablet/desktop only)

- Existing `ScheduleView` component, unchanged
- Hidden on mobile breakpoints

## Event Popover

Clicking any event opens a popover showing:
- Tournament name (linked to `/tournament/[id]`)
- Series name
- Date & time
- Buy-in, game type, format
- Guarantee (if any)
- Priority dropdown (change in place)
- Delete button
- Conflict warning if applicable

## Priority Colors

| Priority | Color |
|----------|-------|
| Target | Blue (primary) |
| Backup | Yellow |
| Maybe | Gray |

## Responsive

- Mobile: Month / Week / Day only (no List)
- Tablet+: All 4 views

## Components

| Component | Purpose |
|-----------|---------|
| `ScheduleCalendar` | Main wrapper — view mode state, date navigation |
| `CalendarMonthView` | Month grid |
| `CalendarWeekView` | Week grid with time axis |
| `CalendarDayView` | Day view with time axis |
| `CalendarEventBlock` | Colored event pill/block (shared) |
| `CalendarEventPopover` | Popover with details + actions |
| `ScheduleView` (existing) | List view, unchanged |

## Data Flow

Same `useSchedule()` hook feeds all views. No API changes. Calendar components render `UserScheduleEntry[]` in different layouts.

## Browse Page: Hide Past Tournaments

Default behavior on `/browse`: only show tournaments where `date >= today`. Applied at the API query level by defaulting `dateFrom` to today's date when no date filter is specified.

## What's NOT Changing

- `useSchedule` hook
- Schedule API routes
- Database schema
- Export .ics functionality
- `ScheduleView` component (list view)
