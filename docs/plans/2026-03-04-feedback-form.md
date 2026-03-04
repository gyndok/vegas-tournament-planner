# Feedback Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/feedback` page where signed-in or anonymous users can submit feedback, which is emailed to `support@nextrebuy.com` via Resend.

**Architecture:** Client-side form page posts to a Next.js API route. API route validates input and sends a formatted HTML email via the existing Resend integration. No database storage.

**Tech Stack:** Next.js App Router, shadcn/ui, Resend, Supabase auth (optional auto-fill)

---

### Task 1: Create the API route

**Files:**
- Create: `src/app/api/feedback/route.ts`

**Step 1: Create the API route handler**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const CATEGORIES = ['Bug Report', 'Feature Request', 'General Feedback', 'Data Issue', 'Other'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, category, subject, message, userId } = body

    // Validate required fields
    if (!name || !email || !category || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    if (message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('RESEND_API_KEY not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const resend = new Resend(apiKey)
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a1a;margin-bottom:4px">${category}</h2>
        <p style="color:#666;font-size:13px;margin-top:0">Received ${timestamp} PT</p>

        <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;width:100px">From</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${name} &lt;${email}&gt;</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">Category</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${category}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">Subject</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${subject}</td>
          </tr>
          ${userId ? `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold">User ID</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666">${userId}</td>
          </tr>` : ''}
        </table>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6">${message}</p>
        </div>

        <p style="margin-top:24px;color:#999;font-size:11px">
          Submitted via NextRebuy feedback form${userId ? ' (authenticated user)' : ' (anonymous)'}.
        </p>
      </div>
    `

    await resend.emails.send({
      from: 'NextRebuy Feedback <onboarding@resend.dev>',
      to: 'support@nextrebuy.com',
      replyTo: email,
      subject: `[NextRebuy Feedback] ${category}: ${subject}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback submission error:', error)
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
  }
}
```

**Step 2: Verify the route file was created correctly**

Run: `cat src/app/api/feedback/route.ts | head -5`
Expected: Shows the import lines.

**Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add feedback API route with Resend email"
```

---

### Task 2: Create the feedback page

**Files:**
- Create: `src/app/feedback/page.tsx`

**Step 1: Create the feedback form page**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/use-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const CATEGORIES = [
  'Bug Report',
  'Feature Request',
  'General Feedback',
  'Data Issue',
  'Other',
]

export default function FeedbackPage() {
  const { user, loading: userLoading } = useUser()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  // Auto-fill from user profile when available
  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name || user.user_metadata?.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name || !email || !category || !subject || !message) {
      setError('Please fill in all fields')
      return
    }

    if (message.length < 10) {
      setError('Please provide more detail in your message (at least 10 characters)')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          category,
          subject,
          message,
          userId: user?.id || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send feedback')
      }

      setSuccess(true)
      setCategory('')
      setSubject('')
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback')
    } finally {
      setSending(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <h2 className="text-xl font-semibold">Thank you for your feedback!</h2>
              <p className="text-muted-foreground">
                We&apos;ve received your message and will get back to you if needed.
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => setSuccess(false)}>
                  Send More Feedback
                </Button>
                <Button asChild>
                  <Link href="/">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Send Feedback</h1>
          <p className="text-sm text-muted-foreground">Help us improve NextRebuy</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Feedback</CardTitle>
            <CardDescription>
              {user
                ? 'Your contact info is pre-filled from your account.'
                : 'Please provide your contact info so we can follow up if needed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your feedback"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us more..."
                rows={5}
                required
              />
              <p className="text-xs text-muted-foreground">
                {message.length < 10
                  ? `${10 - message.length} more characters needed`
                  : `${message.length} characters`}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/">Cancel</Link>
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? (
              'Sending...'
            ) : (
              <>
                <Send className="size-4 mr-2" />
                Send Feedback
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

**Step 2: Verify the page file was created correctly**

Run: `cat src/app/feedback/page.tsx | head -5`
Expected: Shows `'use client'` and imports.

**Step 3: Commit**

```bash
git add src/app/feedback/page.tsx
git commit -m "feat: add feedback form page with auto-fill for signed-in users"
```

---

### Task 3: Add sidebar navigation link

**Files:**
- Modify: `src/components/left-sidebar.tsx` (after the Help & FAQ link, ~lines 168-183)

**Step 1: Add the Feedback link in the sidebar**

Add `MessageSquareText` to the Lucide import (line ~8-18). Then after the Help & FAQ block (~line 183, after the closing `)}` of the FAQ ternary), add the Feedback link:

```tsx
// Add to imports:
import { MessageSquareText } from 'lucide-react'

// After the Help & FAQ link block, add:
          {/* Feedback */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href="/feedback" className="flex w-full items-center justify-center rounded-lg p-2.5 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                  <MessageSquareText className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>Feedback</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/feedback" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
              <MessageSquareText className="size-5" />
              <span>Feedback</span>
            </Link>
          )}
```

**Step 2: Commit**

```bash
git add src/components/left-sidebar.tsx
git commit -m "feat: add Feedback link to sidebar navigation"
```

---

### Task 4: Preview and verify

**Step 1: Start dev server and verify the page loads**

Run: `preview_start` then navigate to `/feedback`
Expected: Form renders with Name, Email, Category, Subject, Message fields.

**Step 2: Verify sidebar link appears**

Expected: "Feedback" link visible in left sidebar below Help & FAQ.

**Step 3: Verify auto-fill works when signed in**

Sign in, navigate to `/feedback`.
Expected: Name and Email are pre-populated.

**Step 4: Test form submission**

Fill form with test data and submit.
Expected: Success confirmation shown. Email received at `support@nextrebuy.com`.

**Step 5: Deploy**

Run: `vercel --prod --yes`
Expected: Production deployment succeeds.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: feedback form - complete implementation"
```
