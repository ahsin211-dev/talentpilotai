# TalentPilot AI

Production-oriented recruitment + migration marketplace foundation focused on **privacy, least privilege, and auditability**.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Row Level Security (RLS)
- AWS S3 (+ KMS) for encrypted document storage
- Anthropic API + OCR pipeline scaffolding
- Upstash QStash for async processing
- Stripe subscription webhook handling

## Portals in this MVP foundation

- **Candidate portal** (`/candidate`)
  - Mobile-first intake form
  - Secure file upload flow (S3 pre-signed URL + metadata validation)
- **Employer portal** (`/employer`)
  - Browse admin-approved redacted candidate profiles
  - Save favourites
  - Request contact unlock
- **Admin dashboard** (`/admin`)
  - Review queue
  - Approve/reject redacted profiles before publication

## Security model

Key requirements are enforced at the database level:

- Private and public profile data are separated (`candidate_private_details` vs `candidate_profiles_public_redacted`).
- Employers can only query approved redacted profile data.
- Employers cannot directly query private details/documents.
- Contact details are exposed via `get_candidate_contact_for_employer(...)` only when candidate approval exists.
- Sensitive write/read operations are audit logged (`audit_logs`, trigger-based mutation logs, explicit RPC logging).
- Frontend never uses service role keys.

## Database migrations and tests

- Migration: `supabase/migrations/202606190001_initial_schema_and_rls.sql`
- Security regression checks: `supabase/tests/rls_security_tests.sql`

Run checks (against a provisioned Supabase/Postgres database):

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/202606190001_initial_schema_and_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/tests/rls_security_tests.sql
```

## Local development

1. Copy env template:

   ```bash
   cp .env.example .env.local
   ```

2. Fill all required secrets in `.env.local`.
3. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

4. Quality checks:

   ```bash
   npm run lint
   npm run typecheck
   npm run test
   ```

## Current scope vs follow-up

### Delivered in this branch

- Security-first schema + RLS + audit triggers/functions
- Role-aware API routes for candidate/employer/admin flows
- Async job skeleton for document pipeline
- Stripe webhook baseline for employer subscription gating
- Mobile-first / desktop-first portal shells

### Follow-up tasks (Phase 2)

- Full OCR (Textract) and Claude extraction orchestration
- Occupation-code mapper with confidence scoring + admin editing UX
- Production webhook retries + dead-letter handling
- End-to-end RLS runtime tests with seeded auth users
- WhatsApp Business, CRM, GoHighLevel, and e-signature integrations
