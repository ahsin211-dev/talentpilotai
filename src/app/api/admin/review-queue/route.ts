import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireAuthenticatedUser(["admin"]);
    const supabase = await createSupabaseServerClient();

    const { data: profileQueue, error: profileError } = await supabase
      .from("candidate_profiles_public_redacted")
      .select(
        "id,candidate_id,headline,profile_status,confidence_score,created_at,updated_at",
      )
      .in("profile_status", ["pending_review", "draft"])
      .order("updated_at", { ascending: true })
      .limit(100);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { data: documentQueue, error: documentError } = await supabase
      .from("candidate_documents")
      .select("id,candidate_id,document_type,processing_status,created_at,updated_at")
      .in("processing_status", ["needs_review", "failed", "completed"])
      .order("updated_at", { ascending: true })
      .limit(100);

    if (documentError) {
      return NextResponse.json({ error: documentError.message }, { status: 500 });
    }

    await recordAuditEvent({
      action: "admin_viewed_review_queue",
      resourceType: "admin_review_queue",
      metadata: {
        profileCount: profileQueue.length,
        documentCount: documentQueue.length,
      },
      accessLevel: "sensitive",
    });

    return NextResponse.json({
      profiles: profileQueue,
      documents: documentQueue,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to load admin review queue." },
      { status: 500 },
    );
  }
}
