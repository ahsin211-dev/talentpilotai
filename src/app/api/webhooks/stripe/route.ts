import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getSubscriptionPeriod } from "@/lib/stripe/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog, AuditActions } from "@/lib/audit/log";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  await admin.from("webhooks").insert({
    provider: "stripe",
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    status: "processing",
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const employerId = session.metadata?.employer_id;
        if (!employerId || !session.subscription) break;

        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const period = getSubscriptionPeriod(subscription);

        await admin.from("subscriptions").upsert({
          employer_id: employerId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items.data[0]?.price.id,
          status: subscription.status as "active",
          current_period_start: period.currentPeriodStart,
          current_period_end: period.currentPeriodEnd,
        });

        await writeAuditLog({
          action: AuditActions.SUBSCRIPTION_CREATE,
          resourceType: "subscription",
          resourceId: employerId,
          metadata: { stripeSubscriptionId: subscription.id },
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const period = getSubscriptionPeriod(subscription);
        await admin
          .from("subscriptions")
          .update({
            status: subscription.status as "active",
            current_period_end: period.currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);

        await writeAuditLog({
          action: AuditActions.SUBSCRIPTION_UPDATE,
          resourceType: "subscription",
          metadata: { status: subscription.status },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
