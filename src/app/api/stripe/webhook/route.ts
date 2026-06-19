import { NextResponse } from "next/server";
import { createStripeServerClient } from "@/lib/stripe/server";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const mapStripeStatus = (status: string) => {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "inactive";
  }
};

export async function POST(req: Request) {
  const env = getServerEnv();
  const stripe = createStripeServerClient();
  const supabase = createSupabaseAdminClient();
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const { data: webhookEvent } = await supabase
    .from("webhooks")
    .insert({
      provider: "stripe",
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      signature_header: signature,
      delivery_status: "received",
    })
    .select("id")
    .single();

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as {
      id: string;
      customer: string;
      status: string;
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      metadata?: Record<string, string>;
    };

    const employerId = subscription.metadata?.employer_id;
    if (employerId) {
      await supabase.from("subscriptions").upsert(
        {
          employer_id: employerId,
          stripe_customer_id: subscription.customer,
          stripe_subscription_id: subscription.id,
          state: mapStripeStatus(subscription.status),
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        },
        { onConflict: "employer_id" },
      );
    }
  }

  if (webhookEvent?.id) {
    await supabase
      .from("webhooks")
      .update({ delivery_status: "processed", processed_at: new Date().toISOString() })
      .eq("id", webhookEvent.id);
  }

  return NextResponse.json({ received: true });
}
