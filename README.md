# TalentPilot AI

Production-ready recruitment marketplace for Australian migration/recruitment agencies. Connects overseas skilled tradespeople with Australian employers through a privacy-first platform with AI document processing and visa case management.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Auth & Database | Supabase Auth + Postgres + Row Level Security |
| Document Storage | AWS S3 with KMS encryption |
| AI Pipeline | Anthropic Claude + AWS Textract (Phase 2) |
| Job Queue | Upstash Redis / QStash |
| Payments | Stripe employer subscriptions |
| Hosting | Vercel |

## Portals

1. **Candidate Portal** (`/candidate`) — Mobile-first onboarding, document upload, status tracking, contact approval
2. **Employer Portal** (`/employer`) — Desktop-first candidate browsing, favourites, contact unlock requests
3. **Admin Dashboard** (`/admin`) — Review queue, document/profile approval, audit logs, occupation codes

## Security Model

- Private candidate data (`candidate_private_details`) is separated from redacted public profiles
- Employers can only view **admin-approved, redacted** profiles via RLS
- Full contact details require explicit `candidate_contact_approval`
- Employers **cannot** access documents, AI output, or private tables
- All sensitive access is audit logged
- Service role key is server-only; never exposed to the client

## Getting Started

### 1. Clone and install

```bash
npm install
cp .env.example .env.local
```

### 2. Configure environment

Fill in `.env.local` with your Supabase, AWS, and Stripe credentials (see `.env.example`).

### 3. Run database migrations

Apply migrations in order via Supabase SQL editor or CLI:

```bash
supabase db push
# or manually run:
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_rls_policies.sql
```

### 4. Create an admin user

After registering a user, promote them via SQL:

```sql
UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@youragency.com';
INSERT INTO admin_users (user_id, display_name) 
SELECT id, 'Admin User' FROM auth.users WHERE email = 'admin@youragency.com';
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test          # Run security and validation tests
npm run lint      # ESLint
npm run build     # Production build
```

## Build Phases

### Phase 1 MVP (current)
- Auth and role setup
- Candidate intake portal
- Secure S3 file upload
- Document processing job structure
- Admin review queue
- Redacted candidate profiles
- Employer browsing + favourites
- Contact unlock request flow
- Stripe subscription setup
- Basic audit logging

### Phase 2
- Full OCR + Claude pipeline
- Occupation code AI mapping
- WhatsApp / GoHighLevel / CRM integrations
- E-signature
- Advanced RLS integration tests against live Supabase

### Phase 3
- Performance optimization
- Reporting dashboard
- Advanced employer matching
- Automated reminders

## Project Structure

```
src/
├── app/
│   ├── candidate/       # Mobile-first candidate portal
│   ├── employer/        # Desktop employer portal
│   ├── admin/           # Internal admin dashboard
│   └── api/             # Server-side API routes
├── components/          # UI and portal components
├── lib/
│   ├── supabase/        # Client, server, admin clients
│   ├── aws/             # S3 upload/download
│   ├── audit/           # Audit logging
│   ├── stripe/          # Subscription management
│   ├── jobs/            # Async document processing
│   └── validation/      # Zod schemas
└── types/               # TypeScript types
supabase/
└── migrations/        # Schema + RLS policies
```

## Security Assumptions & Follow-ups

- RLS policies must be tested against a live Supabase instance with test accounts for each role
- S3 bucket must have block-public-access enabled and KMS default encryption
- Stripe webhook endpoint must be registered in production
- QStash signature verification should be enabled before production job processing
- File content validation (magic bytes) should be added in Phase 2
- Rate limiting on upload and auth endpoints recommended for production

## License

Proprietary — TalentPilot AI
