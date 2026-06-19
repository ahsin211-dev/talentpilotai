import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employerId, candidateId } = await request.json();
  const admin = createAdminClient();

  const { data: employer } = await admin
    .from("employer_accounts")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!employer || employer.id !== employerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("employer_favourites").insert({
    employer_id: employerId,
    candidate_id: candidateId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employerId, candidateId } = await request.json();
  const admin = createAdminClient();

  await admin
    .from("employer_favourites")
    .delete()
    .eq("employer_id", employerId)
    .eq("candidate_id", candidateId);

  return NextResponse.json({ success: true });
}
