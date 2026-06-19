import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: employer } = await supabase
    .from("employer_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: subscription } = employer
    ? await supabase
        .from("subscriptions")
        .select("*")
        .eq("employer_id", employer.id)
        .single()
    : { data: null };

  return NextResponse.json({ employer, subscription });
}
