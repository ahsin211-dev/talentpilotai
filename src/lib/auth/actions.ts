"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { employerSignupSchema } from "@/lib/validation/schemas";
import { logAudit } from "@/lib/audit";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export type FormState = { error?: string } | null;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password format" };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  await logAudit({ action: "user_sign_in", resourceType: "auth" });
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Provision a new user with a role row. Uses the admin client to create the
 * auth user (email pre-confirmed) and the role-specific row in one trusted
 * server operation, then signs the user in with the RLS-bound server client.
 */
async function provisionUser(params: {
  email: string;
  password: string;
  role: "candidate" | "employer";
  employer?: z.infer<typeof employerSignupSchema>;
}): Promise<{ error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    return { error: createErr?.message ?? "Could not create account" };
  }

  const authUserId = created.user.id;

  if (params.role === "candidate") {
    const { error } = await admin.from("candidates").insert({ auth_user_id: authUserId });
    if (error) return { error: error.message };
  } else {
    const e = params.employer!;
    const { error } = await admin.from("employer_accounts").insert({
      auth_user_id: authUserId,
      company_name: e.companyName,
      abn: e.abn ?? null,
      contact_name: e.contactName,
      contact_email: e.contactEmail,
    });
    if (error) return { error: error.message };
  }

  const supabase = createSupabaseServerClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (signInErr) return { error: signInErr.message };

  await logAudit({ action: "user_signed_up", resourceType: params.role });
  return {};
}

export async function signUpCandidate(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Email and an 8+ char password are required" };

  const result = await provisionUser({ ...parsed.data, role: "candidate" });
  if (result.error) return result;
  redirect("/candidate/intake");
}

export async function signUpEmployer(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Email and an 8+ char password are required" };

  const employer = employerSignupSchema.safeParse({
    companyName: formData.get("companyName"),
    abn: formData.get("abn") || undefined,
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
  });
  if (!employer.success) return { error: "Please complete the company details" };

  const result = await provisionUser({
    ...parsed.data,
    role: "employer",
    employer: employer.data,
  });
  if (result.error) return result;
  redirect("/employer");
}
