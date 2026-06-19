"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireActor } from "@/lib/auth/session";
import { candidateIntakeSchema, unlockResponseSchema } from "@/lib/validation/schemas";
import { validateFileMeta, validateMagicBytes, ALLOWED_MIME_TYPES } from "@/lib/files/validate";
import { isStorageConfigured, putObject } from "@/lib/storage/s3";
import { enqueueJob } from "@/lib/queue";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok?: true; error?: string };

/** Save intake details into the PRIVATE table (RLS: candidate self only). */
export async function saveIntake(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("candidate");
  const parsed = candidateIntakeSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country: formData.get("country"),
    nationality: formData.get("nationality") || undefined,
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    occupationTitle: formData.get("occupationTitle"),
    yearsExperience: formData.get("yearsExperience"),
    consentGiven: formData.get("consentGiven") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;
  const supabase = createSupabaseServerClient();

  const { error: detailsErr } = await supabase.from("candidate_private_details").upsert(
    {
      candidate_id: actor.candidateId!,
      first_name: v.firstName,
      last_name: v.lastName,
      email: v.email,
      phone: v.phone,
      country: v.country,
      nationality: v.nationality ?? null,
      date_of_birth: v.dateOfBirth ?? null,
    },
    { onConflict: "candidate_id" },
  );
  if (detailsErr) return { error: detailsErr.message };

  const { error: candErr } = await supabase
    .from("candidates")
    .update({
      status: "intake_in_progress",
      current_stage: "document_review",
      consent_given: true,
      consent_version: "v1",
      consent_at: new Date().toISOString(),
    })
    .eq("id", actor.candidateId!);
  if (candErr) return { error: candErr.message };

  await supabase.from("case_stages").insert({
    candidate_id: actor.candidateId!,
    stage: "document_review",
    notes: `Intake completed for ${v.occupationTitle}`,
  });

  await logAudit({
    action: "candidate_intake_saved",
    resourceType: "candidate_private_details",
    candidateId: actor.candidateId!,
  });
  revalidatePath("/candidate");
  return { ok: true };
}

/**
 * Upload a document: validate (type/size/magic bytes), store encrypted in S3,
 * record the document with its access tier + audit metadata, and enqueue the
 * async AI pipeline. Uses the service-role client ONLY for the storage write +
 * job enqueue (which require bypassing RLS for the jobs table), after the RLS
 * ownership check via requireActor.
 */
export async function uploadDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("candidate");
  const file = formData.get("file");
  const documentType = String(formData.get("documentType") ?? "");

  if (!(file instanceof File)) return { error: "No file provided" };
  if (!ALLOWED_MIME_TYPES.has(file.type)) return { error: `Unsupported type: ${file.type}` };

  const metaCheck = validateFileMeta({ mimeType: file.type, sizeBytes: file.size });
  if (!metaCheck.ok) return { error: metaCheck.error };

  const bytes = Buffer.from(await file.arrayBuffer());
  const magic = validateMagicBytes(file.type, bytes.subarray(0, 8));
  if (!magic.ok) return { error: magic.error };

  if (!isStorageConfigured()) {
    return { error: "Document storage is not configured in this environment." };
  }

  const stored = await putObject({
    candidateId: actor.candidateId!,
    fileName: file.name,
    mimeType: file.type,
    body: bytes,
  });

  const admin = createSupabaseAdminClient();
  const { data: doc, error: docErr } = await admin
    .from("candidate_documents")
    .insert({
      candidate_id: actor.candidateId!,
      document_type: documentType,
      access_tier: "private",
      s3_bucket: stored.bucket,
      s3_key: stored.key,
      kms_key_id: stored.kmsKeyId ?? null,
      file_name: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      upload_status: "uploaded",
      scan_status: "pending",
    })
    .select("id")
    .single();
  if (docErr) return { error: docErr.message };

  await enqueueJob(admin, {
    documentId: doc.id,
    candidateId: actor.candidateId!,
    jobType: "full_pipeline",
  });

  await logAudit(
    {
      action: "candidate_document_uploaded",
      resourceType: "candidate_documents",
      resourceId: doc.id,
      candidateId: actor.candidateId!,
      metadata: { documentType, sizeBytes: file.size },
    },
    admin,
  );
  revalidatePath("/candidate/documents");
  return { ok: true };
}

/** Candidate accepts/declines an employer contact request via the gated RPC. */
export async function respondToUnlock(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireActor("candidate");
  const parsed = unlockResponseSchema.safeParse({
    requestId: formData.get("requestId"),
    approve: formData.get("approve") === "true",
    consentText: formData.get("consentText") || undefined,
    consentVersion: "v1",
  });
  if (!parsed.success) return { error: "Invalid request" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("candidate_respond_to_unlock", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    p_consent_text: parsed.data.consentText ?? null,
    p_consent_version: parsed.data.consentVersion ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/candidate/requests");
  return { ok: true };
}
