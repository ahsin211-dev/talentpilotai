import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createDocumentUploadUrl } from "@/lib/aws/s3";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { enqueueDocumentProcessing } from "@/lib/queue/document-jobs";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";
import { candidateUploadRequestSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["candidate"]);
    const payload = await parseJsonBody(req, candidateUploadRequestSchema);
    const supabase = await createSupabaseServerClient();

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate record not found. Complete intake first." },
        { status: 404 },
      );
    }

    const uploadTarget = await createDocumentUploadUrl({
      candidateId: candidate.id,
      documentType: payload.documentType,
      originalFilename: payload.originalFilename,
      mimeType: payload.mimeType,
      checksumSha256: payload.checksumSha256,
    });

    const { data: document, error: documentError } = await supabase
      .from("candidate_documents")
      .insert({
        candidate_id: candidate.id,
        document_type: payload.documentType,
        original_filename: payload.originalFilename,
        mime_type: payload.mimeType,
        file_size_bytes: payload.fileSizeBytes,
        s3_bucket: uploadTarget.bucket,
        s3_object_key: uploadTarget.objectKey,
        checksum_sha256: payload.checksumSha256,
        kms_key_id: uploadTarget.kmsKeyId,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (documentError || !document) {
      return NextResponse.json(
        { error: documentError?.message ?? "Failed to create document record" },
        { status: 500 },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from("document_processing_jobs")
      .insert({
        candidate_document_id: document.id,
        status: "pending",
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message ?? "Failed to enqueue processing job" },
        { status: 500 },
      );
    }

    await enqueueDocumentProcessing({
      candidateDocumentId: document.id,
      processingJobId: job.id,
    });

    await recordAuditEvent({
      action: "candidate_document_upload_url_issued",
      resourceType: "candidate_documents",
      resourceId: document.id,
      metadata: {
        documentType: payload.documentType,
      },
      accessLevel: "sensitive",
    });

    return NextResponse.json({
      documentId: document.id,
      processingJobId: job.id,
      uploadUrl: uploadTarget.signedUrl,
      uploadHeaders: {
        "Content-Type": payload.mimeType,
        "x-amz-checksum-sha256": payload.checksumSha256,
        "x-amz-server-side-encryption": "aws:kms",
        "x-amz-server-side-encryption-aws-kms-key-id": uploadTarget.kmsKeyId,
      },
      expiresInSeconds: uploadTarget.expiresInSeconds,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unable to prepare secure upload URL." },
      { status: 500 },
    );
  }
}
