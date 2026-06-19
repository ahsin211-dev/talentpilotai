import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { documentUploadSchema } from "@/lib/validation/schemas";
import {
  validateUpload,
  generateS3Key,
  createPresignedUploadUrl,
  BUCKET,
} from "@/lib/aws/s3";
import { queueDocumentProcessing } from "@/lib/jobs/document-processing";
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

    const body = await request.json();
    const parsed = documentUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { documentType, fileName, mimeType, fileSizeBytes } = parsed.data;

    const validation = validateUpload(fileName, mimeType, fileSizeBytes);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: candidate } = await admin
      .from("candidates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const s3Key = generateS3Key(candidate.id, documentType, fileName);

    const { data: doc, error: docError } = await admin
      .from("candidate_documents")
      .insert({
        candidate_id: candidate.id,
        document_type: documentType,
        file_name: fileName,
        file_size_bytes: fileSizeBytes,
        mime_type: mimeType,
        s3_bucket: BUCKET,
        s3_key: s3Key,
        access_tier: "candidate_only",
        status: "pending",
      })
      .select("id")
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: docError?.message }, { status: 500 });
    }

    const uploadUrl = await createPresignedUploadUrl(s3Key, mimeType);

    await queueDocumentProcessing(doc.id, candidate.id);

    await writeAuditLog({
      actorId: user.id,
      actorRole: "candidate",
      action: AuditActions.DOCUMENT_UPLOAD,
      resourceType: "document",
      resourceId: doc.id,
      metadata: { documentType, fileName },
    });

    return NextResponse.json({
      documentId: doc.id,
      uploadUrl,
      s3Key,
    });
  } catch (err) {
    console.error("[upload] Error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
