-- =============================================================================
-- 0002 — Core tables (strict separation of public/redacted vs private data)
--
-- DESIGN RULE: Personally Identifying Information (surname, phone, email,
-- address, passport/ID numbers, DOB) lives ONLY in `candidate_private_details`.
-- The employer-facing surface (`candidate_profiles_public_redacted`) never
-- contains a column that could hold PII. Separation-at-the-table-level means a
-- single missing RLS policy can never accidentally leak a private column to
-- employers, because the column simply does not exist on the public table.
-- =============================================================================

-- updated_at maintenance ------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- ADMIN USERS
-- =============================================================================
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users(id) on delete cascade,
  full_name     text not null,
  role          admin_role not null default 'reviewer',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_admin_users_auth on public.admin_users(auth_user_id);

-- =============================================================================
-- CANDIDATES (account anchor — intentionally holds NO PII)
-- =============================================================================
create table if not exists public.candidates (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null unique references auth.users(id) on delete cascade,
  status          candidate_status not null default 'registered',
  current_stage   case_stage_type not null default 'intake',
  consent_given   boolean not null default false,
  consent_version text,
  consent_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_candidates_auth on public.candidates(auth_user_id);
create trigger trg_candidates_updated_at before update on public.candidates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CANDIDATE PRIVATE DETAILS (SENSITIVE — never reachable by employers)
-- =============================================================================
create table if not exists public.candidate_private_details (
  candidate_id        uuid primary key references public.candidates(id) on delete cascade,
  first_name          text,
  last_name           text,                 -- surname: NEVER exposed to employers
  email               citext,               -- NEVER exposed to employers
  phone               text,                 -- NEVER exposed to employers
  address_line1       text,
  address_line2       text,
  city                text,
  state               text,
  postcode            text,
  country             text,
  nationality         text,
  date_of_birth       date,
  passport_number     text,                 -- NEVER exposed to employers
  national_id_number  text,                 -- NEVER exposed to employers
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_candidate_private_updated_at before update on public.candidate_private_details
  for each row execute function public.set_updated_at();

-- =============================================================================
-- OCCUPATION CODES (ANZSCO reference data)
-- =============================================================================
create table if not exists public.occupation_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  title       text not null,
  skill_level smallint,
  category    text,
  aliases     text[] not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_occupation_codes_updated_at before update on public.occupation_codes
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CANDIDATE PUBLIC / REDACTED PROFILE (the ONLY employer-visible surface)
-- =============================================================================
create table if not exists public.candidate_profiles_public_redacted (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null unique references public.candidates(id) on delete cascade,
  -- Redacted display identity: first name + surname initial only, NEVER surname.
  display_name          text,
  headline              text,
  summary               text,               -- AU-market rewritten + redacted
  occupation_code_id    uuid references public.occupation_codes(id),
  occupation_title      text,
  skills                text[] not null default '{}',
  years_experience      smallint,
  country_of_origin     text,
  availability          text,
  visa_stage            text,
  highest_qualification text,
  redaction_status      redaction_status not null default 'pending',
  is_published          boolean not null default false,
  approved_by           uuid references public.admin_users(id),
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_profiles_published
  on public.candidate_profiles_public_redacted(is_published, redaction_status);
create index if not exists idx_profiles_occupation
  on public.candidate_profiles_public_redacted(occupation_code_id);
create trigger trg_profiles_updated_at before update on public.candidate_profiles_public_redacted
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CANDIDATE DOCUMENTS (raw uploads — employers NEVER reach these)
-- =============================================================================
create table if not exists public.candidate_documents (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  document_type   document_type not null,
  access_tier     document_access_tier not null default 'private',
  s3_bucket       text not null,
  s3_key          text not null,
  s3_version_id   text,
  kms_key_id      text,
  file_name       text not null,
  mime_type       text not null,
  file_size_bytes bigint not null,
  checksum_sha256 text,
  upload_status   upload_status not null default 'pending',
  scan_status     scan_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_documents_candidate on public.candidate_documents(candidate_id);
create trigger trg_documents_updated_at before update on public.candidate_documents
  for each row execute function public.set_updated_at();

-- =============================================================================
-- DOCUMENT PROCESSING JOBS (async pipeline)
-- =============================================================================
create table if not exists public.document_processing_jobs (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.candidate_documents(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  job_type      job_type not null,
  status        job_status not null default 'queued',
  attempts      smallint not null default 0,
  max_attempts  smallint not null default 5,
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  last_error    text,
  payload       jsonb not null default '{}'::jsonb,
  result        jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_jobs_status on public.document_processing_jobs(status, scheduled_at);
create trigger trg_jobs_updated_at before update on public.document_processing_jobs
  for each row execute function public.set_updated_at();

-- =============================================================================
-- AI EXTRACTION RESULTS (raw AI output NEVER exposed to employers)
-- =============================================================================
create table if not exists public.ai_extraction_results (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid references public.candidate_documents(id) on delete set null,
  candidate_id          uuid not null references public.candidates(id) on delete cascade,
  job_id                uuid references public.document_processing_jobs(id) on delete set null,
  model                 text,
  model_version         text,
  raw_output            jsonb,              -- UNREDACTED — admin-only
  redacted_output       jsonb,              -- proposed redacted output
  admin_approved_output jsonb,              -- final, human-approved output
  confidence_score      numeric(5,4),
  suggested_occupation_code_id uuid references public.occupation_codes(id),
  review_status         ai_review_status not null default 'pending',
  reviewer_notes        text,
  reviewed_by           uuid references public.admin_users(id),
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_ai_results_candidate on public.ai_extraction_results(candidate_id);
create index if not exists idx_ai_results_review on public.ai_extraction_results(review_status);
create trigger trg_ai_results_updated_at before update on public.ai_extraction_results
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CASE STAGES (history of case-management transitions)
-- =============================================================================
create table if not exists public.case_stages (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  stage        case_stage_type not null,
  notes        text,
  changed_by   uuid references public.admin_users(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_case_stages_candidate on public.case_stages(candidate_id, created_at);

-- =============================================================================
-- EMPLOYER ACCOUNTS
-- =============================================================================
create table if not exists public.employer_accounts (
  id                  uuid primary key default gen_random_uuid(),
  auth_user_id        uuid not null unique references auth.users(id) on delete cascade,
  company_name        text not null,
  abn                 text,
  contact_name        text,
  contact_email       citext,
  subscription_status subscription_status not null default 'incomplete',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_employer_auth on public.employer_accounts(auth_user_id);
create trigger trg_employer_updated_at before update on public.employer_accounts
  for each row execute function public.set_updated_at();

-- =============================================================================
-- EMPLOYER FAVOURITES
-- =============================================================================
create table if not exists public.employer_favourites (
  id                  uuid primary key default gen_random_uuid(),
  employer_id         uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles_public_redacted(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (employer_id, candidate_profile_id)
);
create index if not exists idx_favourites_employer on public.employer_favourites(employer_id);

-- =============================================================================
-- CONTACT UNLOCK REQUESTS (employer asks to contact a candidate)
-- =============================================================================
create table if not exists public.contact_unlock_requests (
  id            uuid primary key default gen_random_uuid(),
  employer_id   uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  candidate_profile_id uuid references public.candidate_profiles_public_redacted(id) on delete set null,
  status        unlock_status not null default 'pending',
  message       text,
  requested_at  timestamptz not null default now(),
  decided_by    uuid references public.admin_users(id),
  decided_at    timestamptz,
  unique (employer_id, candidate_id)
);
create index if not exists idx_unlock_employer on public.contact_unlock_requests(employer_id);
create index if not exists idx_unlock_candidate on public.contact_unlock_requests(candidate_id);

-- =============================================================================
-- CANDIDATE CONTACT APPROVALS (the explicit candidate consent gate)
--
-- The existence of a row here with approved = true AND revoked_at IS NULL is the
-- ONLY thing that lets an employer obtain a candidate's contact details, and
-- that access is mediated exclusively by a SECURITY DEFINER function (0006).
-- =============================================================================
create table if not exists public.candidate_contact_approvals (
  id                uuid primary key default gen_random_uuid(),
  candidate_id      uuid not null references public.candidates(id) on delete cascade,
  employer_id       uuid not null references public.employer_accounts(id) on delete cascade,
  unlock_request_id uuid references public.contact_unlock_requests(id) on delete set null,
  approved          boolean not null default false,
  consent_text      text,
  consent_version   text,
  approved_at       timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (candidate_id, employer_id)
);
create index if not exists idx_approvals_employer on public.candidate_contact_approvals(employer_id);
create index if not exists idx_approvals_candidate on public.candidate_contact_approvals(candidate_id);
create trigger trg_approvals_updated_at before update on public.candidate_contact_approvals
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SUBSCRIPTIONS (Stripe)
-- =============================================================================
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  employer_id            uuid not null references public.employer_accounts(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  status                 subscription_status not null default 'incomplete',
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_subscriptions_employer on public.subscriptions(employer_id);
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- WEBHOOKS (inbound/outbound event log + idempotency)
-- =============================================================================
create table if not exists public.webhooks (
  id           uuid primary key default gen_random_uuid(),
  provider     webhook_provider not null,
  direction    webhook_direction not null,
  event_type   text,
  external_id  text,
  payload      jsonb not null default '{}'::jsonb,
  status       webhook_status not null default 'received',
  attempts     smallint not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_id)
);
create index if not exists idx_webhooks_status on public.webhooks(status);

-- =============================================================================
-- AUDIT LOGS (append-only)
-- =============================================================================
create table if not exists public.audit_logs (
  id                  bigint generated always as identity primary key,
  actor_auth_user_id  uuid,
  actor_role          text,
  action              text not null,
  resource_type       text,
  resource_id         text,
  candidate_id        uuid,
  employer_id         uuid,
  metadata            jsonb not null default '{}'::jsonb,
  ip_address          inet,
  user_agent          text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_logs(created_at);
create index if not exists idx_audit_candidate on public.audit_logs(candidate_id);
create index if not exists idx_audit_action on public.audit_logs(action);
