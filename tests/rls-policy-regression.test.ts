import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260619061500_initial_marketplace_schema.sql"),
  "utf8"
);

describe("database privacy boundaries", () => {
  it("keeps employer browsing on the redacted profile table", () => {
    expect(migration).toContain("candidate_profiles_public_redacted");
    expect(migration).toContain("redacted_profiles_candidate_admin_employer_read");
    expect(migration).toContain("is_employer_visible = true");
    expect(migration).toContain("employer_has_active_subscription(ea.id)");
  });

  it("does not grant employers direct private contact access", () => {
    expect(migration).toContain("revoke all on public.candidate_private_details from anon, authenticated");
    expect(migration).toContain("private_details_candidate_or_admin");
    expect(migration).not.toMatch(/create policy .*employer.*candidate_private_details/i);
  });

  it("requires candidate approval before employer contact release", () => {
    expect(migration).toContain("get_approved_candidate_contact");
    expect(migration).toContain("candidate_contact_approvals");
    expect(migration).toContain("revoked_at is null");
    expect(migration).toContain("employer_contact_details_accessed");
  });

  it("keeps raw documents and AI extraction output out of employer policies", () => {
    expect(migration).toContain("candidate_documents_candidate_or_admin");
    expect(migration).toContain("ai_results_admin_only");
    expect(migration).not.toMatch(/create policy .*employer.*candidate_documents/i);
    expect(migration).not.toMatch(/create policy .*employer.*ai_extraction_results/i);
  });
});
