"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { unlockRequestSchema } from "@/lib/validation/schemas";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe/stripe";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok?: true; error?: string } | null;

/** Save / remove a favourite (RLS gates this to subscribed employers). */
export async function toggleFavourite(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("employer");
  const profileId = String(formData.get("profileId") ?? "");
  const remove = formData.get("remove") === "true";
  const supabase = createSupabaseServerClient();

  if (remove) {
    const { error } = await supabase
      .from("employer_favourites")
      .delete()
      .eq("employer_id", actor.employerId!)
      .eq("candidate_profile_id", profileId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("employer_favourites")
      .insert({ employer_id: actor.employerId!, candidate_profile_id: profileId });
    if (error) return { error: error.message };
  }
  revalidatePath("/employer");
  revalidatePath("/employer/favourites");
  return { ok: true };
}

/** Raise a contact-unlock request (RLS requires an active subscription). */
export async function requestUnlock(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("employer");
  const parsed = unlockRequestSchema.safeParse({
    candidateId: formData.get("candidateId"),
    candidateProfileId: formData.get("candidateProfileId") || undefined,
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) return { error: "Invalid request" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("contact_unlock_requests").insert({
    employer_id: actor.employerId!,
    candidate_id: parsed.data.candidateId,
    candidate_profile_id: parsed.data.candidateProfileId ?? null,
    message: parsed.data.message ?? null,
  });
  if (error) return { error: error.message };

  await logAudit({
    action: "employer_unlock_requested",
    resourceType: "contact_unlock_requests",
    candidateId: parsed.data.candidateId,
    employerId: actor.employerId!,
  });
  revalidatePath("/employer/requests");
  return { ok: true };
}

/**
 * Reveal contact details. This calls the DB-gated `get_unlocked_contact` RPC,
 * which only returns data if the candidate has explicitly approved AND writes
 * an audit-log entry. Any other path is impossible — employers have no RLS
 * access to the private table.
 */
export async function revealContact(candidateId: string): Promise<
  | { ok: true; contact: Record<string, string | null> }
  | { ok: false; error: string }
> {
  await requireActor("employer");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_unlocked_contact", {
    p_candidate_id: candidateId,
  });
  if (error) return { ok: false, error: "Contact not unlocked. The candidate has not approved access." };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "No contact details available." };
  return { ok: true, contact: row };
}

export async function startCheckout(): Promise<{ url?: string; error?: string }> {
  const actor = await requireActor("employer");
  if (!isStripeConfigured()) {
    return { error: "Billing is not configured in this environment." };
  }
  const supabase = createSupabaseServerClient();
  const { data: emp } = await supabase
    .from("employer_accounts")
    .select("contact_email")
    .eq("id", actor.employerId!)
    .maybeSingle();

  const { url } = await createCheckoutSession({
    employerId: actor.employerId!,
    customerEmail: emp?.contact_email ?? undefined,
  });
  if (!url) return { error: "Could not start checkout" };
  return { url };
}
