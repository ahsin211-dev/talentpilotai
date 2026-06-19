import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/client';
import { createServiceClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

function getSubscriptionPeriod(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return {
    current_period_start: item?.current_period_start
      ? new Date(item.current_period_start * 1000).toISOString()
      : null,
    current_period_end: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const service = createServiceClient();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const employerId = session.metadata?.employer_id;
    if (employerId && session.subscription) {
      const subResponse = await stripe.subscriptions.retrieve(session.subscription as string);
      const sub = subResponse as Stripe.Subscription;
      const period = getSubscriptionPeriod(sub);
      await service.from('subscriptions').update({
        stripe_subscription_id: sub.id,
        stripe_price_id: sub.items.data[0]?.price.id,
        status: sub.status as 'active' | 'trialing' | 'canceled',
        current_period_start: period.current_period_start,
        current_period_end: period.current_period_end,
      }).eq('employer_id', employerId);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const period = getSubscriptionPeriod(sub);
    await service.from('subscriptions').update({
      status: sub.status as 'active' | 'trialing' | 'canceled' | 'past_due',
      current_period_start: period.current_period_start,
      current_period_end: period.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
    }).eq('stripe_subscription_id', sub.id);
  }

  return NextResponse.json({ received: true });
}
