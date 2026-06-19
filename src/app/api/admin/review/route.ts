import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileApprovalSchema, documentReviewSchema } from "@/lib/validation/schemas";
import { getAuthContext } from "@/lib/auth/helpers";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, AuditActions } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await getAuthContext(user.id);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type } = body;

    const admin = createAdminClient();

    if (type === "profile") {
      const parsed = profileApprovalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const updates =
        parsed.data.action === "approve"
          ? {
              status: "approved" as const,
              approved_at: new Date().toISOString(),
              approved_by: user.id,
              ...(parsed.data.adminEditedFields ?? {}),
            }
          : { status: "rejected" as const };

      await admin
        .from("candidate_profiles_public_redacted")
        .update(updates)
        .eq("id", parsed.data.profileId);

      if (parsed.data.action === "approve") {
        const { data: profile } = await admin
          .from("candidate_profiles_public_redacted")
          .select("candidate_id")
          .eq("id", parsed.data.profileId)
          .single();

        if (profile) {
          const { data: publishedStage } = await admin
            .from("case_stages")
            .select("id")
            .eq("code", "published")
            .single();

          if (publishedStage) {
            await admin
              .from("candidates")
              .update({ case_stage_id: publishedStage.id })
              .eq("id", profile.candidate_id);
          }
        }
      }

      await writeAuditLog({
        actorId: user.id,
        actorRole: "admin",
        action:
          parsed.data.action === "approve"
            ? AuditActions.PROFILE_APPROVE
            : AuditActions.PROFILE_REJECT,
        resourceType: "profile",
        resourceId: parsed.data.profileId,
      });
    } else if (type === "document") {
      const parsed = documentReviewSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      await admin
        .from("candidate_documents")
        .update({
          status: parsed.data.action === "approve" ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", parsed.data.documentId);

      await writeAuditLog({
        actorId: user.id,
        actorRole: "admin",
        action: AuditActions.ADMIN_REVIEW,
        resourceType: "document",
        resourceId: parsed.data.documentId,
        metadata: { action: parsed.data.action },
      });
    } else {
      return NextResponse.json({ error: "Invalid review type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
