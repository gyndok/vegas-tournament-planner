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
