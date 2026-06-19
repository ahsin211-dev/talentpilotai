# TalentPilot AI

Security-first recruitment marketplace for an Australian migration and recruitment
agency. The platform connects overseas skilled tradespeople with Australian
employers and keeps private candidate data separated from employer-facing
profiles by design.

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth + Postgres + Row Level Security
- AWS S3 + KMS for document storage
- Anthropic Claude for AI extraction and rewriting
- Upstash Redis for async job orchestration
- Stripe for employer subscriptions

## Foundation delivered in this scaffold

- Mobile-first candidate portal shell
- Desktop-first employer portal shell
- Admin review dashboard shell
- Supabase migration with core tables and RLS policies
- Backend route handlers for intake, upload presign, favourites, unlock requests,
  admin publish, and Stripe webhook ingestion
- Security helpers for redaction, audit logging, and S3 signed upload URLs
- Focused tests covering redaction behavior and critical RLS artifacts

## Project structure

```text
src/
  app/
    api/
    admin/
    candidate/
    employer/
  lib/
    ai/
    auth/
    queue/
    security/
    storage/
    supabase/
supabase/
  migrations/
```

## Security model

- Candidate PII lives in `candidate_private_details`.
- Employer-facing data lives in `candidate_profiles_public_redacted`.
- Employers do not get direct table access to private candidate details.
- Contact release happens through an audited database function after a
  `candidate_contact_approval` exists.
- Raw AI output and approved output are stored separately.
- Sensitive operations should be audit logged.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   AWS_REGION=
   AWS_S3_BUCKET=
   AWS_KMS_KEY_ID=
   ANTHROPIC_API_KEY=
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=
   STRIPE_SECRET_KEY=
   STRIPE_WEBHOOK_SECRET=
   ```

3. Run the app:

   ```bash
   npm run dev
   ```

4. Run tests:

   ```bash
   npm test
   ```

## Important assumptions

- This repo currently ships a secure MVP foundation, not a fully integrated
  production deployment.
- RLS artifact tests run without a live database; execution tests should be
  added in a Supabase local environment next.
- Document processing queue transitions after upload confirmation still need
  bucket event or callback wiring in a follow-up iteration.
