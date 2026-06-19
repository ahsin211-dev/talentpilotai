import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckoutSession, createCustomerPortalSession } from "@/lib/stripe/client";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();
    const admin = createAdminClient();

    const { data: employer } = await admin
      .from("employer_accounts")
      .select("id, contact_email, company_name")
      .eq("user_id", user.id)
      .single();

    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (action === "checkout") {
      const stripe = getStripe();
      let customerId: string;

      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("employer_id", employer.id)
        .single();

      if (sub?.stripe_customer_id) {
        customerId = sub.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({
          email: employer.contact_email,
          name: employer.company_name,
          metadata: { employer_id: employer.id },
        });
        customerId = customer.id;

        await admin.from("subscriptions").upsert({
          employer_id: employer.id,
          stripe_customer_id: customerId,
          status: "incomplete",
        });
      }

      const session = await createCheckoutSession(
        customerId,
        employer.id,
        `${appUrl}/employer/subscription?success=true`,
        `${appUrl}/employer/subscription?canceled=true`
      );

      return NextResponse.json({ url: session.url });
    }

    if (action === "portal") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("employer_id", employer.id)
        .single();

      if (!sub?.stripe_customer_id) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 });
      }

      const session = await createCustomerPortalSession(
        sub.stripe_customer_id,
        `${appUrl}/employer/subscription`
      );

      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[stripe]", err);
    return NextResponse.json({ error: "Stripe error" }, { status: 500 });
  }
}
