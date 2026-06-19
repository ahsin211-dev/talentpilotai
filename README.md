# TalentPilotAI

A privacy-first recruitment marketplace connecting overseas skilled tradespeople
with Australian employers, with an AI document-processing pipeline and
visa/immigration case management.

This is built as a **regulated, privacy-sensitive production platform**: data
security, audit logging, and access control are core requirements — not
afterthoughts. The single most important rule is enforced at the **database**
layer with PostgreSQL Row Level Security:

> Employer accounts can **never** access a candidate's surname, phone, email,
> address, ID/passport numbers, raw documents, or raw AI output — unless the
> candidate **explicitly** approves contact. This is enforced in the database,
> not just the UI.

---

## Tech stack

| Concern            | Choice                                                        |
| ------------------ | ------------------------------------------------------------- |
| Framework          | Next.js 14 (App Router) + TypeScript                          |
| Auth + DB          | Supabase Auth + Postgres + **Row Level Security**            |
| Document storage   | AWS S3 with **SSE-KMS** encryption + pre-signed URLs          |
| OCR                | AWS Textract (with deterministic stub fallback)              |
| AI extraction      | Anthropic Claude (with deterministic heuristic fallback)     |
| Async jobs         | Durable Postgres job table + Upstash Redis fast-path + worker |
| Payments           | Stripe employer subscriptions (DB-enforced feature gate)     |
| Hosting            | Vercel                                                        |
| Integrations       | WhatsApp Business, GoHighLevel, recruitment CRM, e-signature |

> The AI, OCR, S3, Stripe and Redis layers all **degrade gracefully** to safe
> stubs when their credentials are not configured, so the whole platform — and
> its test-suite — runs end-to-end locally without external services.

---

## Security architecture

### Strict table separation

PII is physically separated from the employer-visible surface. A single missing
policy can never leak a private column to employers because the column does not
exist on the public table.

- `candidates` — account anchor, **holds no PII**
- `candidate_private_details` — surname, email, phone, address, DOB, passport/ID
- `candidate_profiles_public_redacted` — the **only** employer-visible surface
- `candidate_documents` — raw uploads (employers have no policy at all)
- `ai_extraction_results` — **raw** AI output (admin-only) kept separate from the
  admin-approved output
- `contact_unlock_requests` / `candidate_contact_approvals` — the consent gate
- `employer_accounts`, `employer_favourites`, `subscriptions`
- `admin_users`, `case_stages`, `document_processing_jobs`, `occupation_codes`
- `audit_logs` (append-only), `webhooks`

See [`docs/SECURITY.md`](docs/SECURITY.md) and the migrations in
[`supabase/migrations`](supabase/migrations) for the full model.

### How access is enforced

- Every table has RLS enabled with **default-deny**.
- On Supabase, every end-user shares the `authenticated` Postgres role; the actor
  type (candidate / employer / admin) is derived from app tables via
  `SECURITY DEFINER` helpers (`is_employer()`, `current_candidate_id()`, …).
- Employers have **no** RLS policy on the private tables. The only path to a
  candidate's contact details is the `get_unlocked_contact()` RPC, which:
  1. checks the caller is an employer,
  2. requires a non-revoked `candidate_contact_approval`,
  3. writes an audit-log entry,
  4. then returns the data.
- The **service-role key bypasses RLS** and is used only by trusted server code
  (worker, webhooks, provisioning). It is `import "server-only"` guarded and must
  never reach the browser.
- Employer feature access is gated on an **active Stripe subscription** at the DB
  layer (`employer_subscription_active()`), updated only by the Stripe webhook.

---

## Project layout

```
supabase/
  migrations/            # ordered SQL: schema, RLS, audit, views, RPCs, seed
  tests/00_local_bootstrap.sql   # local-only Supabase auth/role emulation
src/
  app/                   # App Router: landing, auth, candidate/employer/admin, api
  components/            # UI + client form components
  lib/
    supabase/            # RLS-bound server client + service-role admin client
    auth/                # actor resolution + auth server actions
    candidate|employer|admin/  # server actions per portal
    ai/                  # claude, textract, redaction, occupation mapping
    storage/             # S3 + KMS + signed URLs
    queue/               # durable job queue
    pipeline/            # OCR -> extract -> redact -> classify orchestration
    stripe/              # subscriptions + webhook verification
    files/               # type/size/magic-byte validation
    audit.ts, env.ts, validation/schemas.ts (Zod)
scripts/                 # db-apply (migrations), worker (poller)
tests/
  rls/                   # security/RLS test-suite against real Postgres
  unit/                  # pure-logic tests (redaction, mapping, validation)
```

---

## Getting started

### 1. Install

```bash
npm install
cp .env.example .env.local   # fill in what you have; stubs cover the rest
```

### 2. Database

**Supabase (production / staging):** apply the files in
`supabase/migrations` in order (e.g. `supabase db push`, or paste into the SQL
editor). Do **not** run the local bootstrap or `db:reset` against Supabase.

**Local Postgres (dev / CI):**

```bash
export DATABASE_URL="postgres://user@localhost:5432/talentpilot"
npm run db:setup      # bootstrap (auth shim + roles) + migrations
# npm run db:reset    # drop & recreate public+auth, then re-apply (LOCAL ONLY)
```

### 3. Run

```bash
npm run dev           # http://localhost:3000
npm run worker        # in another shell: drains the AI job queue
```

---

## Testing

```bash
npm test          # all tests
npm run test:rls  # security / RLS suite (needs DATABASE_URL Postgres)
npm run test:unit # pure-logic suite (no DB required)
npm run typecheck # tsc --noEmit
npm run lint      # next lint
```

The RLS suite is the **executable proof** of the acceptance criteria. It applies
the real migrations to a real Postgres and impersonates candidate / employer /
admin / anon / service-role identities to assert, among other things:

- employers see **zero** rows from `candidate_private_details`, `candidate_documents`
  and `ai_extraction_results`;
- employers without an active subscription see **zero** profiles;
- `get_unlocked_contact()` is denied before approval and works only after the
  candidate approves — and the private table itself stays unreadable even then;
- candidates can read only their own data;
- a plain reviewer cannot read audit logs (senior+ only);
- nobody can `UPDATE`/`DELETE` audit logs;
- sensitive access is audit-logged.

---

## AI document pipeline

1. Candidate uploads a document → validated (type/size/magic bytes) → stored
   **encrypted** in S3 with audit metadata and an access tier.
2. A `full_pipeline` job is enqueued (durable in Postgres).
3. The worker: OCR → Claude extraction → AU-market rewrite → PII redaction →
   ANZSCO occupation mapping → confidence score.
4. **Raw** output and **redacted** output are persisted **separately**;
   `review_status = pending`.
5. An admin reviews/edits and **approves** — only then is a redacted profile
   published to employers. Raw AI output is never exposed.

Failures use exponential backoff and move to a `dead_letter` state after
`max_attempts`, surfaced in the admin **Jobs** screen for retry.

---

## Build phases

- **Phase 1 (MVP) — implemented here:** auth + roles, candidate intake, secure
  S3 upload, job structure, admin review queue, redacted profile creation,
  employer browsing/favourites, contact-unlock flow, Stripe subscription
  scaffolding, audit logging, full RLS + tests.
- **Phase 2:** full OCR+Claude wiring, richer occupation tooling, advanced case
  management, WhatsApp/GoHighLevel/CRM/e-signature integrations, hardening.
- **Phase 3:** performance, reporting dashboards, advanced matching, automated
  reminders.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the threat model, assumptions, and
follow-up tasks.
