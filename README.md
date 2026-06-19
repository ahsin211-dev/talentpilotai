# TalentPilot AI

Production-ready recruitment marketplace for Australian migration and recruitment agencies. Connects overseas skilled tradespeople with Australian employers through a privacy-first platform with AI document processing, visa case management, and strict database-level access control.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Auth & Database | Supabase Auth, Postgres, Row Level Security |
| Document Storage | AWS S3 with KMS encryption |
| Payments | Stripe subscriptions |
| AI Pipeline (Phase 2) | AWS Textract, Anthropic Claude |
| Async Jobs (Phase 2) | Upstash Redis |
| Hosting | Vercel |

## Portals

1. **Candidate Portal** (`/candidate`) — Mobile-first intake, document upload, consent, status tracking
2. **Employer Portal** (`/employer`) — Desktop-first browsing of redacted profiles, favourites, contact requests
3. **Admin Dashboard** (`/admin`) — Review queue, profile approval, audit logs

## Security Model

Access control is enforced at the **database level** via Supabase RLS, not only in the UI:

- `candidate_private_details` — surname, phone, email, passport (never visible to employers without approval)
- `candidate_profiles_public_redacted` — admin-approved, redacted profiles for employers
- `candidate_contact_approvals` — explicit candidate consent before contact details are shared
- `ai_extraction_results` — raw AI output never exposed to employers
- `candidate_documents` — encrypted S3 storage, signed URLs, employer access blocked

## Getting Started

### 1. Clone and install

```bash
npm install
cp .env.example .env.local
```

### 2. Set up Supabase

1. Create a Supabase project
2. Run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_phase2_integrations.sql`
3. Add your keys to `.env.local`

### 3. Create an admin user

After registering a user, promote to admin in SQL:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

INSERT INTO admin_users (user_id, display_name, admin_role)
SELECT id, 'Admin User', 'super_admin' FROM auth.users WHERE email = 'admin@example.com';
```

### 4. Configure AWS S3

Create an encrypted bucket with KMS in `ap-southeast-2` and set AWS env vars.

### 5. Configure Stripe

Create an employer subscription price and set Stripe env vars. Forward webhooks to `/api/webhooks/stripe`.

### 6. Configure Phase 2 services

| Service | Env vars | Purpose |
|---------|----------|---------|
| Anthropic Claude | `ANTHROPIC_API_KEY` | Document extraction, CV rewrite, occupation mapping |
| AWS Textract | `AWS_*` | OCR on uploaded documents |
| Upstash QStash | `QSTASH_TOKEN`, signing keys | Async document processing jobs |
| WhatsApp | `WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Candidate notifications |
| GoHighLevel | `GOHIGHLEVEL_API_KEY`, `GOHIGHLEVEL_LOCATION_ID` | CRM contact sync |
| Recruitment CRM | `CRM_SYNC_URL`, `CRM_API_KEY` | External CRM webhook |
| E-signature | `ESIGNATURE_WEBHOOK_SECRET` | Consent signing webhook at `/api/webhooks/esignature` |

Without `QSTASH_TOKEN`, document processing runs inline after upload (dev mode).
Without `ANTHROPIC_API_KEY`, a mock extraction is used for testing.

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing

```bash
npm run test        # RLS policy static verification + validation tests
npm run lint
npm run build
```

For full RLS integration tests, run `supabase/tests/rls_policies.test.sql` against a local Supabase instance with seeded test users.

## Phase 1 MVP (Implemented)

- [x] Auth and role setup (candidate, employer, admin)
- [x] Candidate mobile-first intake portal
- [x] Secure S3 file upload with presigned URLs
- [x] Document processing job structure (stub pipeline)
- [x] Admin review queue
- [x] Redacted candidate profile creation and approval
- [x] Employer browsing of approved profiles
- [x] Employer favourites
- [x] Contact unlock request flow with candidate approval
- [x] Stripe employer subscription setup
- [x] Basic audit logging

## Phase 2 (Implemented)

- [x] Full OCR pipeline (AWS Textract)
- [x] Claude extraction, CV rewrite, occupation code mapping
- [x] PII redaction and confidence scoring
- [x] Admin AI editing and approval workflow
- [x] Async job queue via Upstash QStash (inline fallback for dev)
- [x] Case management stage transitions
- [x] WhatsApp Business notifications
- [x] GoHighLevel + CRM sync
- [x] E-signature webhook integration
- [x] Webhook delivery retry and admin integrations dashboard
- [x] Failed job retry from admin review queue

## Phase 3 (Planned)

- Full OCR (Textract) + Claude extraction pipeline
- Occupation code AI mapping
- Confidence scoring and admin editing workflow
- Full case management stages
- WhatsApp, GoHighLevel, CRM, e-signature integrations
- Advanced audit logs and RLS integration test suite

## Modified Files (Phase 1)

See git history for full list. Key areas:

- `supabase/migrations/` — Database schema and RLS policies
- `src/lib/` — Supabase clients, S3, auth, audit, validation, jobs, Stripe
- `src/app/candidate/` — Mobile candidate portal
- `src/app/employer/` — Desktop employer portal
- `src/app/admin/` — Admin dashboard
- `src/app/api/` — Document upload, Stripe webhooks
- `src/tests/rls.test.ts` — Security policy verification

## Security Assumptions & Follow-ups

1. **Service role key** must only be used in server-side code (API routes, server actions)
2. **S3 bucket policy** should deny public access; only IAM role used by the app
3. **Stripe webhooks** must verify signatures in production
4. **Admin promotion** is manual in Phase 1; add invite-only admin registration later
5. **Phase 2** should add Upstash worker for async document processing instead of inline stub
6. **Penetration testing** recommended before production launch

## License

Proprietary — TalentPilot AI
