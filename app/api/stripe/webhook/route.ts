/**
 * POST /api/stripe/webhook — Handles Stripe webhook events
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

// Lazy Stripe client — never instantiate at module scope (build-time env not available)
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  // Idempotency check
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .single()

  if (existing) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan

        if (userId && plan) {
          await supabase
            .from('profiles')
            .update({
              plan,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        const priceId = subscription.items.data[0]?.price.id

        if (userId) {
          const planMap: Record<string, string> = {
            [process.env.STRIPE_BUILDER_PRICE_ID!]: 'builder',
            [process.env.STRIPE_STUDIO_PRICE_ID!]: 'studio',
          }
          const plan = planMap[priceId] || 'free'
          const status = subscription.status

          await supabase
            .from('profiles')
            .update({
              plan: status === 'active' ? plan : 'free',
              stripe_subscription_id: subscription.id,
            })
            .eq('id', userId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id

        if (userId) {
          await supabase
            .from('profiles')
            .update({ plan: 'free', stripe_subscription_id: null })
            .eq('id', userId)
        }
        break
      }
    }

    // Record processed event
    await supabase.from('stripe_events').insert({
      id: event.id,
      type: event.type,
    })

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook] Handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
