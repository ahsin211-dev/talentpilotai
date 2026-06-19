-- =============================================================================
-- 0001 — Extensions & enumerated types
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";      -- case-insensitive email

-- --- Enumerated domain types -------------------------------------------------
do $$ begin
  create type candidate_status as enum (
    'registered', 'intake_in_progress', 'documents_submitted', 'in_review',
    'profile_published', 'matched', 'placed', 'inactive', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type case_stage_type as enum (
    'intake', 'document_review', 'ai_processing', 'admin_review',
    'profile_published', 'employer_matching', 'contact_approved',
    'placed', 'rejected', 'withdrawn'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum (
    'cv', 'passport', 'national_id', 'qualification',
    'certificate', 'reference', 'other'
  );
exception when duplicate_object then null; end $$;

-- Access tiers gate which actors may ever touch a document record.
--   private          -> raw uploads (CV, passport, ID). Candidate + admin only.
--   internal         -> derived working copies for reviewers.
--   redacted_derived -> redacted artefacts safe for employer-facing context.
do $$ begin
  create type document_access_tier as enum ('private', 'internal', 'redacted_derived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type upload_status as enum ('pending', 'uploaded', 'quarantined', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scan_status as enum ('pending', 'clean', 'infected', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type redaction_status as enum ('pending', 'in_review', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_type as enum ('ocr', 'extract', 'rewrite', 'classify', 'redact', 'full_pipeline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead_letter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ai_review_status as enum ('pending', 'approved', 'rejected', 'edited');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unlock_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('reviewer', 'senior_reviewer', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum (
    'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type webhook_provider as enum ('stripe', 'whatsapp', 'gohighlevel', 'crm', 'esignature');
exception when duplicate_object then null; end $$;

do $$ begin
  create type webhook_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type webhook_status as enum ('received', 'processed', 'failed');
exception when duplicate_object then null; end $$;
