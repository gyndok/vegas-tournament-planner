# Feedback Form Design

## Overview

Add a feedback page at `/feedback` that lets users (signed-in or anonymous) submit feedback via a form. Submissions are emailed to `support@nextrebuy.com` using the existing Resend integration.

## Form Fields

| Field    | Type           | Required | Notes                          |
|----------|----------------|----------|--------------------------------|
| Name     | Text input     | Yes      | Auto-filled if signed in       |
| Email    | Email input    | Yes      | Auto-filled if signed in       |
| Category | Select dropdown| Yes      | Bug Report, Feature Request, General Feedback, Data Issue, Other |
| Subject  | Text input     | Yes      | Short summary                  |
| Message  | Textarea       | Yes      | Details, min 10 chars          |

## Behavior

- Signed-in users: name/email auto-populated from user profile, still editable
- Anonymous users: must fill in name/email manually
- On submit: POST to `/api/feedback`
- API route sends formatted email via Resend to `support@nextrebuy.com`
- Reply-to set to submitter's email address
- Success: confirmation message, form resets
- Error: error alert displayed
- Client-side validation: required fields, valid email format, min message length

## Email Format

- **Subject:** `[NextRebuy Feedback] {category}: {subject}`
- **Body:** Name, email, category, message, timestamp, user ID (if signed in)
- **Reply-to:** submitter's email

## Navigation

- Add "Feedback" link in left sidebar, below Help & FAQ

## Storage

- Email only, no database table

## Tech Stack

- Page: Next.js app router (`src/app/feedback/page.tsx`)
- API: Next.js route handler (`src/app/api/feedback/route.ts`)
- Email: Resend (already configured)
- UI: shadcn/ui components (Input, Label, Select, Textarea, Button, Card)
- Auth: Supabase (optional, for auto-fill)
