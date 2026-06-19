"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { candidateIntakeSchema } from "@/lib/validation/schemas";
import { writeAuditLog } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";

export async function submitCandidateIntake(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const parsed = candidateIntakeSchema.safeParse({
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    country: formData.get("country"),
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    consentGiven: formData.get("consentGiven") === "true",
    consentVersion: "1.0",
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const admin = createAdminClient();
  const { data: candidate } = await admin
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) return { error: "Candidate record not found" };

  const { data: docsStage } = await admin
    .from("case_stages")
    .select("id")
    .eq("code", "documents_pending")
    .single();

  await admin.from("candidate_private_details").upsert({
    candidate_id: candidate.id,
    first_name: parsed.data.firstName,
    surname: parsed.data.surname,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    country: parsed.data.country,
    date_of_birth: parsed.data.dateOfBirth ?? null,
  });

  await admin
    .from("candidates")
    .update({
      consent_given_at: new Date().toISOString(),
      consent_version: parsed.data.consentVersion,
      case_stage_id: docsStage?.id,
    })
    .eq("id", candidate.id);

  await admin.from("candidate_profiles_public_redacted").upsert({
    candidate_id: candidate.id,
    display_first_name: parsed.data.firstName,
    country_of_origin: parsed.data.country,
    status: "draft",
  });

  await writeAuditLog({
    actorId: user.id,
    actorRole: "candidate",
    action: "candidate.intake_complete",
    resourceType: "candidate",
    resourceId: candidate.id,
  });

  revalidatePath("/candidate");
  return { success: true };
}
