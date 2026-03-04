# NextRebuy Pro Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-time $4.99 "Go Pro" payment via Stripe Checkout that permanently removes ads.

**Architecture:** Client clicks upgrade → API creates Stripe Checkout session → user pays on Stripe's hosted page → Stripe webhook fires → API sets `subscription_tier: 'pro'` in Supabase user metadata → ad-context (already wired) hides all ads.

**Tech Stack:** Stripe Checkout (hosted), Next.js API routes, Supabase admin client, existing shadcn/ui components

---

### Task 1: Install Stripe and create checkout API route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`

**Step 1: Install the Stripe SDK**

Run: `npm install stripe`

**Step 2: Create the checkout API route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Already Pro?
    if (user.user_metadata?.subscription_tier === 'pro') {
      return NextResponse.json({ error: 'Already a Pro member' }, { status: 400 })
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY
    const priceId = process.env.STRIPE_PRICE_ID
    if (!stripeKey || !priceId) {
      console.error('Stripe not configured')
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 })
    }

    const stripe = new Stripe(stripeKey)

    const origin = request.headers.get('origin') || 'https://nextrebuy.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, userEmail: user.email || '' },
      customer_email: user.email || undefined,
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
```

**Step 3: Verify the file was created**

Run: `head -5 src/app/api/stripe/checkout/route.ts`
Expected: Shows import lines.

**Step 4: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts package.json package-lock.json
git commit -m "feat: add Stripe checkout API route"
```

---

### Task 2: Create the Stripe webhook handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`

**Step 1: Create the webhook route**

```ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    console.error('Stripe webhook not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.userId
    if (!userId) {
      console.error('No userId in session metadata')
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 })
    }

    // Use Supabase admin client to update user metadata
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase admin not configured')
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { subscription_tier: 'pro' },
    })

    if (updateError) {
      console.error('Failed to update user metadata:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    console.log(`User ${userId} upgraded to Pro`)
  }

  return NextResponse.json({ received: true })
}
```

**Step 2: Verify the file was created**

Run: `head -5 src/app/api/stripe/webhook/route.ts`
Expected: Shows import lines.

**Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat: add Stripe webhook handler for Pro upgrades"
```

---

### Task 3: Create the success page

**Files:**
- Create: `src/app/pro/success/page.tsx`

**Step 1: Create the success page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Crown } from 'lucide-react'
import Link from 'next/link'

export default function ProSuccessPage() {
  const { user, loading } = useUser()
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    if (user?.user_metadata?.subscription_tier === 'pro') {
      setIsPro(true)
    }
  }, [user])

  // Poll for Pro status (webhook may take a moment)
  useEffect(() => {
    if (isPro || loading) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/stripe/status')
        const data = await res.json()
        if (data.isPro) {
          setIsPro(true)
          // Refresh user data so ad-context picks up the change
          window.location.reload()
        }
      } catch {
        // ignore
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isPro, loading])

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-12">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            {isPro ? (
              <>
                <div className="relative">
                  <CheckCircle2 className="size-16 text-emerald-500" />
                  <Crown className="size-6 text-amber-500 absolute -top-1 -right-1" />
                </div>
                <h2 className="text-2xl font-bold">Welcome to Pro!</h2>
                <p className="text-muted-foreground max-w-md">
                  Thank you for your support! Ads have been removed from your NextRebuy experience.
                </p>
              </>
            ) : (
              <>
                <div className="animate-pulse">
                  <Crown className="size-16 text-amber-500" />
                </div>
                <h2 className="text-2xl font-bold">Processing your upgrade...</h2>
                <p className="text-muted-foreground max-w-md">
                  This usually takes just a few seconds. Hang tight!
                </p>
              </>
            )}
            <div className="flex gap-3 mt-4">
              <Button asChild>
                <Link href="/">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Create the status check API route**

Create `src/app/api/stripe/status/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ isPro: false })
    }

    const isPro = user.user_metadata?.subscription_tier === 'pro'
    return NextResponse.json({ isPro })
  } catch {
    return NextResponse.json({ isPro: false })
  }
}
```

**Step 3: Commit**

```bash
git add src/app/pro/success/page.tsx src/app/api/stripe/status/route.ts
git commit -m "feat: add Pro success page with status polling"
```

---

### Task 4: Update the sidebar upgrade button

**Files:**
- Modify: `src/components/left-sidebar.tsx` (lines 254-268, the "Upgrade to Pro" placeholder)

**Step 1: Replace the existing placeholder with a functional upgrade button**

Replace the existing "Upgrade to Pro" placeholder block (lines 254-268) with a working button that:
- Shows "Go Pro — $4.99" for free signed-in users
- Shows "Pro ✓" badge for Pro users
- Handles the click to create a Stripe checkout session and redirect
- Works in both collapsed and expanded sidebar states

Replace the block starting with `{!collapsed && (` (line 254) through the closing `)}` (line 268) with:

```tsx
          {/* Pro upgrade / status */}
          {!loading && user && (
            <>
              {user.user_metadata?.subscription_tier === 'pro' ? (
                // Pro user — show badge
                !collapsed && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <Crown className="size-4" />
                      <span>Pro Member</span>
                    </div>
                  </div>
                )
              ) : (
                // Free user — show upgrade CTA
                <>
                  <Separator className="my-2 bg-sidebar-border" />
                  {collapsed ? (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/stripe/checkout', { method: 'POST' })
                              const data = await res.json()
                              if (data.url) window.location.href = data.url
                            } catch { /* ignore */ }
                          }}
                          className="flex w-full items-center justify-center rounded-lg p-2.5 text-amber-500 hover:bg-sidebar-accent transition-colors"
                        >
                          <Crown className="size-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>Go Pro — $4.99</TooltipContent>
                    </Tooltip>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/stripe/checkout', { method: 'POST' })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                        } catch { /* ignore */ }
                      }}
                      className="w-full rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-3 hover:from-amber-500/20 hover:to-orange-500/20 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <Crown className="size-4" />
                        <span>Go Pro</span>
                        <span className="ml-auto text-[10px] font-normal text-sidebar-foreground/50">$4.99</span>
                      </div>
                      <p className="text-[10px] text-sidebar-foreground/50 mt-1">
                        Remove all ads forever
                      </p>
                    </button>
                  )}
                </>
              )}
            </>
          )}
```

Note: `Crown` is already imported in the file (line 17). The `Separator` is already imported too.

**Step 2: Commit**

```bash
git add src/components/left-sidebar.tsx
git commit -m "feat: replace sidebar Pro placeholder with functional upgrade button"
```

---

### Task 5: Add Pro section to Settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

**Step 1: Add Crown import and Pro section**

Add `Crown` to the Lucide import (line 14):
```ts
import { LogIn, Save, Check, AlertCircle, Crown } from 'lucide-react'
```

Then add a Pro status card at the top of the settings form, right after the feedback alert (after line 161), before the Buy-in Range card:

```tsx
      {/* Pro Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Pro Membership
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.user_metadata?.subscription_tier === 'pro' ? (
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/10 p-2">
                <Check className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium">You&apos;re a Pro member!</p>
                <p className="text-xs text-muted-foreground">Ads are permanently removed from your experience.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Remove all ads from NextRebuy with a one-time payment.
              </p>
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/stripe/checkout', { method: 'POST' })
                    const data = await res.json()
                    if (data.url) window.location.href = data.url
                  } catch { /* ignore */ }
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                <Crown className="size-4 mr-2" />
                Go Pro — $4.99
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
```

**Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: add Pro membership section to Settings page"
```

---

### Task 6: Build, preview, and deploy

**Step 1: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 2: Start dev server and verify**

Run: `preview_start` then navigate to `/settings`
Expected: Pro Membership card visible with upgrade button. Sidebar shows "Go Pro — $4.99".

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "feat: NextRebuy Pro upgrade - complete implementation"
```

**Step 4: Deploy**

Run: `vercel --prod --yes`
Expected: Deployment succeeds.

**Note:** Before the upgrade flow works end-to-end, you must:
1. Create a Stripe account at stripe.com
2. Create a Product ("NextRebuy Pro") with a $4.99 one-time price
3. Set up a webhook endpoint pointing to `https://nextrebuy.com/api/stripe/webhook` listening for `checkout.session.completed`
4. Add these env vars to Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
