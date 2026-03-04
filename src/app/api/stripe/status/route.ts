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
