import Stripe from "stripe";

/** Extract billing period from subscription items (Stripe API v22+). */
export function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  return {
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000).toISOString()
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  };
}
