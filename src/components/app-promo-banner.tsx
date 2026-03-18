'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Smartphone, BarChart3, Bot, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

const APP_STORE_URL =
  'https://apps.apple.com/us/app/pokerstacktrackerpro/id6760260251'

const highlights = [
  { icon: BarChart3, label: 'Live Stack Tracking' },
  { icon: Bot, label: 'AI Chat Updates' },
  { icon: Camera, label: 'Scan Blind Structures' },
]

interface AppPromoBannerProps {
  /** "inline" for landing page / dashboard, "sidebar" for right sidebar */
  variant?: 'inline' | 'sidebar'
  className?: string
}

export function AppPromoBanner({
  variant = 'inline',
  className,
}: AppPromoBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  if (variant === 'sidebar') {
    return (
      <Card
        className={cn(
          'relative overflow-hidden border-primary/30 bg-gradient-to-b from-primary/5 to-primary/10',
          className
        )}
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/60 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
        <CardContent className="p-4 space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Smartphone className="size-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Companion App
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight">
              StackTrackerPro
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Track sessions live at the table with AI-powered updates &amp;
              analytics.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {highlights.map((h) => (
              <Badge
                key={h.label}
                variant="secondary"
                className="text-[10px] gap-1 px-1.5 py-0.5"
              >
                <h.icon className="size-2.5" />
                {h.label}
              </Badge>
            ))}
          </div>
          <Button asChild size="sm" className="w-full text-xs">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              Download Free on App&nbsp;Store
            </a>
          </Button>
          <p className="text-[10px] text-muted-foreground/60">
            iOS &middot; Free &middot; No data collected
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Inline variant (landing page / dashboard) ──
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5',
        className
      )}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/60 text-muted-foreground/60 hover:text-muted-foreground transition-colors z-10"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
      <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8">
        {/* Icon / visual */}
        <div className="flex shrink-0 size-20 sm:size-24 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <Smartphone className="size-10 sm:size-12 text-primary" />
        </div>

        {/* Copy */}
        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h3 className="text-lg font-bold tracking-tight">
              StackTrackerPro
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              Free
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            The companion app for serious players. Track tournaments &amp; cash
            games live with AI-powered updates, real-time coaching, video recaps,
            and deep analytics.
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
            {highlights.map((h) => (
              <Badge
                key={h.label}
                variant="outline"
                className="text-xs gap-1.5 px-2 py-0.5"
              >
                <h.icon className="size-3" />
                {h.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Button asChild size="lg">
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              Download&nbsp;Free
            </a>
          </Button>
          <p className="text-[10px] text-muted-foreground/60">
            iOS &middot; No data collected
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
