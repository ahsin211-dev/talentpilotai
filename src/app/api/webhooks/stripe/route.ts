import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { verifyWebhookSignature, mapSubscriptionStatus, isStripeConfigured } from "@/lib/stripe/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Stripe webhook. Signature is verified before any processing. Subscription
 * state is the source of truth for the DB-level employer feature gate, so this
 * handler (running with the service-role client) is the ONLY writer of
 * subscription / employer subscription_status fields.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    return NextResponse.json({ error: `invalid_signature: ${(err as Error).message}` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Idempotency: record the event; ignore duplicates.
  const { error: dupeErr } = await admin.from("webhooks").insert({
    provider: "stripe",
    direction: "inbound",
    event_type: event.type,
    external_id: event.id,
    payload: event as unknown as Record<string, unknown>,
    status: "received",
  });
  if (dupeErr) {
    // Unique violation => already processed.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(admin, event);
    await admin
      .from("webhooks")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "stripe")
      .eq("external_id", event.id);
  } catch (err) {
    await admin
      .from("webhooks")
      .update({ status: "failed", last_error: (err as Error).message })
      .eq("provider", "stripe")
      .eq("external_id", event.id);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const employerId = session.metadata?.employerId ?? session.client_reference_id;
      if (!employerId) return;
      await admin.from("subscriptions").upsert(
        {
          employer_id: employerId,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
          status: "active",
        },
        { onConflict: "stripe_subscription_id" },
      );
      await admin.from("employer_accounts").update({ subscription_status: "active" }).eq("id", employerId);
      await logAudit({ action: "subscription_activated", resourceType: "subscriptions", employerId }, admin);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const status = mapSubscriptionStatus(sub.status);
      const { data: row } = await admin
        .from("subscriptions")
        .update({
          status,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: sub.cancel_at_period_end,
        })
        .eq("stripe_subscription_id", sub.id)
        .select("employer_id")
        .maybeSingle();
      if (row?.employer_id) {
        await admin.from("employer_accounts").update({ subscription_status: status }).eq("id", row.employer_id);
      }
      break;
    }
    default:
      break;
  }
}
