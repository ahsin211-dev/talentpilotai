import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { employerRegisterSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = employerRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();

    const { error } = await admin.from("employer_accounts").upsert({
      user_id: user.id,
      company_name: parsed.data.companyName,
      abn: parsed.data.abn ?? null,
      industry: parsed.data.industry ?? null,
      contact_first_name: parsed.data.contactFirstName,
      contact_surname: parsed.data.contactSurname,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: employerRecord } = await admin
      .from("employer_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (employerRecord) {
      await admin.from("subscriptions").upsert({
        employer_id: employerRecord.id,
        status: "incomplete",
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
