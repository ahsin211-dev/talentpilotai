import { randomUUID } from "node:crypto";

import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { enqueueDocumentProcessingJob } from "@/lib/document-processing";
import { getServerEnv } from "@/lib/env";
import { jsonError, jsonOk } from "@/lib/http";
import { buildCandidateDocumentKey, createEncryptedPutUrl } from "@/lib/s3";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentUploadRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("candidate");
    const payload = documentUploadRequestSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const env = getServerEnv();

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", payload.candidateId)
      .single();

    if (candidateError || !candidate) {
      throw new Error("Candidate record not found for authenticated user");
    }

    const documentId = randomUUID();
    const s3Key = buildCandidateDocumentKey(payload.candidateId, documentId, payload.filename);
    const uploadUrl = await createEncryptedPutUrl({
      s3Key,
      contentType: payload.contentType,
      byteSize: payload.byteSize,
      checksumSha256: payload.checksumSha256
    });

    const { error: documentError } = await supabase.from("candidate_documents").insert({
      id: documentId,
      candidate_id: payload.candidateId,
      uploaded_by: actor.userId,
      document_type: payload.documentType,
      status: "uploaded",
      original_filename: payload.filename,
      content_type: payload.contentType,
      byte_size: payload.byteSize,
      s3_bucket: env.S3_DOCUMENT_BUCKET,
      s3_key: s3Key,
      s3_kms_key_id: env.S3_KMS_KEY_ID,
      checksum_sha256: payload.checksumSha256 ?? null,
      access_tier: "private"
    });

    if (documentError) {
      throw new Error(documentError.message);
    }

    const admin = createSupabaseAdminClient();
    const { data: job, error: jobError } = await admin
      .from("document_processing_jobs")
      .insert({
        document_id: documentId,
        status: "queued"
      })
      .select("id")
      .single();

    if (jobError) {
      throw new Error(jobError.message);
    }

    await enqueueDocumentProcessingJob(job.id);
    await writeAuditLog({
      action: "candidate_document_upload_url_created",
      targetTable: "candidate_documents",
      targetId: documentId,
      metadata: {
        documentType: payload.documentType,
        byteSize: payload.byteSize,
        jobId: job.id
      }
    });

    return jsonOk(
      {
        documentId,
        uploadUrl,
        requiredHeaders: {
          "content-type": payload.contentType,
          "x-amz-server-side-encryption": "aws:kms",
          "x-amz-server-side-encryption-aws-kms-key-id": env.S3_KMS_KEY_ID
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
