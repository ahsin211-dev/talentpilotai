# Security model, assumptions & follow-ups

This document describes how TalentPilotAI enforces its privacy guarantees, the
assumptions made, and the security follow-up work for later phases.

## Acceptance criteria → where it is enforced

| Criterion | Enforcement |
| --- | --- |
| Employer cannot access unredacted candidate data via UI/API/direct query/manipulated request | RLS default-deny on `candidate_private_details`, `candidate_documents`, `ai_extraction_results` with **no employer policy**; PII lives in separate tables; contact only via the audited `get_unlocked_contact()` RPC. Proven in `tests/rls/security.test.ts`. |
| Private documents encrypted & access-controlled | S3 **SSE-KMS** at rest; private buckets; access only via short-lived pre-signed URLs issued after an RLS ownership check + audit log. |
| Sensitive access is audit logged | `log_audit()` RPC for reads (signed URLs, profile views, contact unlocks) + `AFTER` write triggers on sensitive tables; `audit_logs` is append-only. |
| Employer-visible profile is redacted & admin-approved | `candidate_profiles_public_redacted` has no PII columns; employer SELECT requires `is_published AND redaction_status='approved'`; defensive `redactText()` + `assertNoPii()` before publish. |
| AI output never blindly published | Pipeline writes `review_status='pending'`; raw vs approved output stored separately; publish requires an admin action. |
| Stripe subscription gates employer features | `employer_subscription_active()` is part of the employer RLS policies for browsing, favourites and unlock requests; only the Stripe webhook (service-role) writes subscription status. |
| Admin dashboard supports safe review & case progression | Reviewer+ RLS on review tables; role-tiered access (`reviewer` < `senior_reviewer` < `admin` < `super_admin`); audit logs restricted to senior+. |

## Defence-in-depth layers

1. **Table separation** — PII columns do not exist on the employer-facing table.
2. **RLS default-deny** — every table; helpers are `SECURITY DEFINER` with pinned
   `search_path` to prevent recursion and search-path hijacking.
3. **Gated RPCs** — `get_unlocked_contact`, `candidate_respond_to_unlock`,
   `candidate_revoke_contact` are the only privileged cross-actor paths.
4. **Server-only secrets** — service-role key, AWS/Stripe/Anthropic keys are
   `import "server-only"` guarded; build fails if pulled into a client bundle.
5. **Input validation** — Zod at every API/server-action boundary; file
   type/size/magic-byte checks before storage.
6. **Append-only audit** — no `UPDATE`/`DELETE` policies on `audit_logs`.
7. **App-layer guards** — `requireActor()` and middleware route protection as UX
   convenience on top of (never instead of) RLS.

## Assumptions

- Supabase provides the `auth` schema, `auth.uid()/jwt()/role()` and the
  `anon` / `authenticated` / `service_role` roles in production. The local
  bootstrap (`supabase/tests/00_local_bootstrap.sql`) reproduces these for tests
  and **must not** be run against a real Supabase project.
- The Stripe webhook is the sole writer of subscription status; its endpoint
  verifies signatures and is idempotent via the `webhooks` table.
- The worker endpoint is invoked by a trusted scheduler (Vercel Cron / QStash)
  and is protected by a constant-time shared-secret check.

## Known follow-ups / hardening backlog

- **Column-level** restriction so employers cannot flip their own
  `employer_accounts.subscription_status` via row update (currently relies on the
  webhook being the only writer + app-layer field omission; add a Postgres
  trigger or a restricted update policy enumerating allowed columns).
- Multi-worker safety: replace the optimistic job claim with a
  `SELECT … FOR UPDATE SKIP LOCKED` RPC.
- Virus/malware scanning of uploads (ClamAV / S3 + Lambda) — schema fields
  (`scan_status`) are in place.
- Rate limiting on auth and unlock-request endpoints.
- Pen-test the manipulated-JWT path on a live Supabase project.
- Data-retention / right-to-erasure jobs for candidate PII.
- Encrypt selected `candidate_private_details` columns at rest with pgsodium /
  Vault in addition to disk encryption.
