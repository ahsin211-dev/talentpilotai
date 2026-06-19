import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    });
  }
  return stripeInstance;
}

export const EMPLOYER_PRICE_ID = process.env.STRIPE_EMPLOYER_PRICE_ID!;

export async function createCheckoutSession(
  customerId: string,
  employerId: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: EMPLOYER_PRICE_ID, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { employer_id: employerId },
  });
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
