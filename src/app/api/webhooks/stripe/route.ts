import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/security/audit";

export async function POST(request: Request) {
  try {
    const env = getServerEnv(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    const stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      throw new Error("Missing Stripe signature.");
    }

    const rawBody = await request.text();
    const stripe = new Stripe(stripeSecretKey);
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    );

    const supabase = createSupabaseAdminClient();

    await supabase.from("webhooks").insert({
      provider: "stripe",
      event_id: event.id,
      status: "received",
      payload: event
    });

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const employerId = subscription.metadata.employer_id;
      const periodEnd = subscription.items.data[0]?.current_period_end;

      if (employerId) {
        await supabase.from("subscriptions").upsert(
          {
            employer_id: employerId,
            stripe_customer_id: subscription.customer?.toString() ?? null,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            plan_code: subscription.items.data[0]?.price.lookup_key ?? "default",
            current_period_end_at: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
    }

    await logAuditEvent({
      actorUserId: null,
      actorRole: "system",
      action: `webhook.stripe.${event.type}`,
      targetTable: "webhooks",
      targetId: event.id,
      metadata: {
        livemode: event.livemode
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 400 }
    );
  }
}
