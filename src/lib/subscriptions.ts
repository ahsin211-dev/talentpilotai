import "server-only";

import Stripe from "stripe";

import { getServerEnv } from "@/lib/env";

let stripe: Stripe | undefined;

export function getStripe() {
  const env = getServerEnv();

  stripe ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: {
      name: "TalentPilotAI"
    }
  });

  return stripe;
}
