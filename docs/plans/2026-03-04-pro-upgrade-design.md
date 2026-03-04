# NextRebuy Pro — Design

## Overview

One-time $4.99 payment that permanently removes ads from NextRebuy. Powered by Stripe Checkout.

## What Pro Includes

- Ad removal (all placements: dashboard banner, browse inline, tournament detail, sidebar)
- That's it. Simple value prop, no feature gates.

## Pricing

| | Free | Pro |
|---|---|---|
| Price | $0 | $4.99 (one-time) |
| Ads | Yes | No |
| All features | Yes | Yes |

## User Flow

1. User sees "Upgrade to Pro" in sidebar and/or settings page
2. Must be signed in (anonymous users see "Sign in to go Pro")
3. Clicks upgrade → POST to `/api/stripe/checkout` creates a Stripe Checkout session
4. Redirected to Stripe's hosted checkout page (handles cards, Apple Pay, Google Pay)
5. After payment → Stripe sends webhook to `/api/stripe/webhook`
6. Webhook handler sets `subscription_tier: 'pro'` in user's Supabase `user_metadata`
7. User redirected back to NextRebuy → ads are gone immediately

## Technical Architecture

### Payment Provider

Stripe Checkout (hosted). No credit card forms on our site. Stripe handles PCI compliance, receipts, tax.

### Data Storage

No new database tables. Pro status stored in Supabase `auth.users.user_metadata.subscription_tier`.

Already wired up in `src/components/ad-context.tsx`:
```ts
const isPro = user?.user_metadata?.subscription_tier === 'pro'
const showAds = !isPro && !!publisherId
```

### API Routes

**POST `/api/stripe/checkout`**
- Requires authenticated user
- Creates a Stripe Checkout session for the $4.99 one-time product
- Includes `userId` in session metadata for webhook processing
- Returns checkout URL → client redirects to Stripe

**POST `/api/stripe/webhook`**
- Receives Stripe `checkout.session.completed` event
- Verifies webhook signature with signing secret
- Extracts `userId` from session metadata
- Updates Supabase user metadata: `subscription_tier: 'pro'`

### UI Components

**Upgrade button (sidebar)**
- Shows for signed-in free users only
- Positioned near bottom of sidebar, above Feedback link
- Collapsed: sparkle icon; Expanded: "Go Pro" with sparkle icon

**Settings page section**
- Free users: shows upgrade CTA with benefits
- Pro users: shows "You're a Pro!" confirmation with purchase date

**Success page**
- `/pro/success` — shown after returning from Stripe checkout
- Confirms purchase and that ads are now removed

### Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Stripe Setup (Manual)

1. Create Stripe account
2. Create Product: "NextRebuy Pro"
3. Create Price: $4.99 one-time
4. Create webhook endpoint pointing to `/api/stripe/webhook`
5. Listen for `checkout.session.completed` event
6. Copy API keys and webhook signing secret to Vercel env vars

## Security

- Webhook signature verification prevents spoofed requests
- User must be authenticated to create checkout session
- Supabase admin client (service role) used to update user metadata in webhook
- No sensitive payment data touches our server

## Edge Cases

- User already Pro → hide upgrade button, show status in settings
- Payment fails → Stripe handles retry/error messaging on their checkout page
- Webhook fails → Stripe retries automatically (up to 3 days)
- User not signed in → prompt to sign in before upgrading
