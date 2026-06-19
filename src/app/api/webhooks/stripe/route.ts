import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { getStripe } from "@/lib/subscriptions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const env = getServerEnv();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return jsonOk({ ignored: true }, { status: 400 });
    }

    const rawBody = await request.text();
    const event = getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    const admin = createSupabaseAdminClient();

    await admin.from("webhooks").upsert(
      {
        provider: "stripe",
        event_type: event.type,
        external_event_id: event.id,
        status: "processing",
        payload: event as unknown as Record<string, unknown>
      },
      { onConflict: "provider,external_event_id" }
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const employerId = session.metadata?.employerId ?? session.client_reference_id;

      if (employerId && session.customer && session.subscription) {
        await admin.from("subscriptions").upsert(
          {
            employer_id: employerId,
            stripe_customer_id: String(session.customer),
            stripe_subscription_id: String(session.subscription),
            stripe_price_id: env.STRIPE_EMPLOYER_PRICE_ID,
            status: "active"
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await admin
        .from("subscriptions")
        .update({
          status: subscription.status,
          current_period_end: subscription.items.data[0]?.current_period_end
            ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end
        })
        .eq("stripe_subscription_id", subscription.id);
    }

    await admin
      .from("webhooks")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "stripe")
      .eq("external_event_id", event.id);

    return jsonOk({ received: true });
  } catch (error) {
    return jsonError(error);
  }
}
