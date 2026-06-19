/**
 * Stripe integration for employer subscriptions. Subscription state is the
 * source of truth for gating employer features — and that gate is enforced at
 * the DB layer (see `employer_subscription_active()` + RLS), updated only by the
 * Stripe webhook running with the service-role client.
 */
import "server-only";
import Stripe from "stripe";
import { serverEnv, publicEnv, isConfigured } from "@/lib/env";

let cached: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return isConfigured(serverEnv.stripe.secretKey);
}

export function stripe(): Stripe {
  if (!isStripeConfigured()) throw new Error("Stripe is not configured");
  if (cached) return cached;
  cached = new Stripe(serverEnv.stripe.secretKey, { apiVersion: "2024-10-28.acacia" });
  return cached;
}

export async function createCheckoutSession(params: {
  employerId: string;
  customerEmail?: string;
  existingCustomerId?: string;
}): Promise<{ url: string | null }> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: serverEnv.stripe.priceIdStandard, quantity: 1 }],
    customer: params.existingCustomerId,
    customer_email: params.existingCustomerId ? undefined : params.customerEmail,
    client_reference_id: params.employerId,
    metadata: { employerId: params.employerId },
    success_url: `${publicEnv.appUrl}/employer/billing?status=success`,
    cancel_url: `${publicEnv.appUrl}/employer/billing?status=cancelled`,
  });
  return { url: session.url };
}

/** Map a Stripe subscription status to our enum. */
export function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "incomplete";
  }
}

export function verifyWebhookSignature(body: string, signature: string): Stripe.Event {
  return stripe().webhooks.constructEvent(body, signature, serverEnv.stripe.webhookSecret);
}
