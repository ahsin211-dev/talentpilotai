import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

export const createStripeServerClient = () => {
  const { STRIPE_SECRET_KEY } = getServerEnv();
  return new Stripe(STRIPE_SECRET_KEY);
};
