import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { createSensitiveReadUrl } from "@/lib/s3";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole("candidate", "admin");
    const { documentId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: document, error } = await supabase
      .from("candidate_documents")
      .select("id,s3_key,document_type,status")
      .eq("id", documentId)
      .single();

    if (error || !document) {
      throw new Error("Document not found or access denied");
    }

    const signedUrl = await createSensitiveReadUrl(document.s3_key);

    await writeAuditLog({
      action: "sensitive_document_signed_url_created",
      targetTable: "candidate_documents",
      targetId: document.id,
      metadata: {
        documentType: document.document_type,
        status: document.status
      }
    });

    return jsonOk({ signedUrl, expiresInSeconds: 300 });
  } catch (error) {
    return jsonError(error);
  }
}
