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
