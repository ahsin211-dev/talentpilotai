import { headers } from "next/headers";

import { requireRole } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { getStripe } from "@/lib/subscriptions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const actor = await requireRole("employer");
    const supabase = await createSupabaseServerClient();
    const env = getServerEnv();
    const headerStore = await headers();
    const origin = headerStore.get("origin") ?? "http://localhost:3000";

    const { data: employer, error } = await supabase
      .from("employer_accounts")
      .select("id,billing_email,company_name")
      .eq("user_id", actor.userId)
      .single();

    if (error || !employer) {
      throw new Error("Employer account not found");
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: employer.billing_email,
      line_items: [
        {
          price: env.STRIPE_EMPLOYER_PRICE_ID,
          quantity: 1
        }
      ],
      success_url: `${origin}/employer?checkout=success`,
      cancel_url: `${origin}/employer?checkout=cancelled`,
      client_reference_id: employer.id,
      subscription_data: {
        metadata: {
          employerId: employer.id
        }
      },
      metadata: {
        employerId: employer.id
      }
    });

    return jsonOk({ checkoutUrl: session.url });
  } catch (error) {
    return jsonError(error);
  }
}
