import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/auth/access";
import { documentUploadRequestSchema } from "@/lib/domain";
import { logAuditEvent } from "@/lib/security/audit";
import { createDocumentUploadUrl } from "@/lib/storage/s3";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = documentUploadRequestSchema.parse(await request.json());
    const { supabase, user } = await requireAuthenticatedSession();
    const adminClient = createSupabaseAdminClient();

    const { data: candidate } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", payload.candidateId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!candidate) {
      throw new Error("Candidate record not found for the authenticated user.");
    }

    const { documentKey, uploadUrl } = await createDocumentUploadUrl(payload, user.id);

    const { data: documentRecord, error: documentError } = await adminClient
      .from("candidate_documents")
      .insert({
        candidate_id: payload.candidateId,
        document_type: payload.documentType,
        original_file_name: payload.fileName,
        storage_key: documentKey,
        mime_type: payload.contentType,
        size_bytes: payload.sizeBytes,
        access_tier: "private",
        upload_status: "awaiting_upload"
      })
      .select("id")
      .single();

    if (documentError || !documentRecord) {
      throw documentError ?? new Error("Document record was not created.");
    }

    await adminClient.from("document_processing_jobs").insert({
      candidate_document_id: documentRecord.id,
      status: "awaiting_upload",
      provider: "pipeline"
    });

    await logAuditEvent({
      actorUserId: user.id,
      actorRole: "candidate",
      action: "candidate.document.upload_url_requested",
      targetTable: "candidate_documents",
      targetId: documentRecord.id,
      metadata: {
        documentType: payload.documentType,
        sizeBytes: payload.sizeBytes
      }
    });

    return NextResponse.json({
      ok: true,
      documentId: documentRecord.id,
      uploadUrl,
      documentKey
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 400 }
    );
  }
}
