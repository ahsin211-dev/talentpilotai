import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPresignedDownloadUrl } from "@/lib/aws/s3";
import { writeAuditLog, AuditActions } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/helpers";

export async function GET(request: NextRequest) {
  try {
    const documentId = request.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await getAuthContext(user.id);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("candidate_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Authorization: candidates own docs, admins all, employers NEVER
    if (auth.role === "employer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (auth.role === "candidate") {
      const { data: candidate } = await admin
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!candidate || candidate.id !== doc.candidate_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const downloadUrl = await createPresignedDownloadUrl(doc.s3_key);

    await writeAuditLog({
      actorId: user.id,
      actorRole: auth.role,
      action: AuditActions.DOCUMENT_DOWNLOAD,
      resourceType: "document",
      resourceId: documentId,
    });

    return NextResponse.json({ downloadUrl });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
