import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260619062000_initial_security_foundation.sql"
);
const migration = readFileSync(migrationPath, "utf8");

describe("RLS migration artifacts", () => {
  it("keeps private details separate from public profiles", () => {
    expect(migration).toContain("create table public.candidate_private_details");
    expect(migration).toContain(
      "create table public.candidate_profiles_public_redacted"
    );
  });

  it("blocks direct employer access to private tables and exposes audited access function", () => {
    expect(migration).not.toContain("create policy candidate_private_details_employer");
    expect(migration).toContain(
      "create or replace function public.get_candidate_contact_details"
    );
    expect(migration).toContain("perform public.record_audit_event(");
  });

  it("requires approved redacted profiles for employer browsing", () => {
    expect(migration).toContain(
      "create policy candidate_profiles_employer_redacted_only"
    );
    expect(migration).toContain("approval_status = 'approved'");
  });

  it("enables RLS on all sensitive data tables", () => {
    expect(migration).toContain(
      "alter table public.candidate_private_details enable row level security;"
    );
    expect(migration).toContain(
      "alter table public.candidate_documents enable row level security;"
    );
    expect(migration).toContain(
      "alter table public.audit_logs enable row level security;"
    );
  });
});
