-- TalentPilot AI: Initial schema for recruitment marketplace
-- Run before RLS policies (002_rls_policies.sql)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE public.app_role AS ENUM ('candidate', 'employer', 'admin');
CREATE TYPE public.admin_role AS ENUM ('reviewer', 'manager', 'super_admin');
CREATE TYPE public.document_type AS ENUM ('cv', 'passport', 'id', 'qualification', 'consent', 'other');
CREATE TYPE public.document_status AS ENUM ('pending', 'processing', 'review_required', 'approved', 'rejected');
CREATE TYPE public.job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE public.unlock_request_status AS ENUM ('pending', 'approved', 'rejected', 'expired', 'withdrawn');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
CREATE TYPE public.access_tier AS ENUM ('candidate_only', 'admin_only', 'employer_redacted', 'employer_full_contact');
CREATE TYPE public.webhook_status AS ENUM ('pending', 'delivered', 'failed', 'retrying');

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin users (internal staff)
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_role public.admin_role NOT NULL DEFAULT 'reviewer',
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Occupation codes (ANZSCO / agency mapping)
CREATE TABLE public.occupation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  skill_level INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case stages
CREATE TABLE public.case_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidates
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  given_name TEXT,
  preferred_name TEXT,
  country_of_origin TEXT,
  current_location TEXT,
  occupation_code_id UUID REFERENCES public.occupation_codes(id),
  case_stage_id UUID REFERENCES public.case_stages(id),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  consent_version TEXT,
  availability_date DATE,
  years_experience INTEGER,
  skills TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private candidate details (NEVER exposed to employers without approval)
CREATE TABLE public.candidate_private_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  surname TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  country TEXT,
  passport_number TEXT,
  passport_country TEXT,
  passport_expiry DATE,
  id_document_number TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin-approved redacted profiles (employer-visible)
CREATE TABLE public.candidate_profiles_public_redacted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  headline TEXT,
  summary TEXT,
  occupation_title TEXT,
  occupation_code_id UUID REFERENCES public.occupation_codes(id),
  country_of_origin TEXT,
  years_experience INTEGER,
  skills TEXT[] DEFAULT '{}',
  qualifications_summary TEXT,
  availability_date DATE,
  visa_stage TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES public.admin_users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employer accounts
CREATE TABLE public.employer_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  abn TEXT,
  industry TEXT,
  contact_given_name TEXT,
  website TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL UNIQUE REFERENCES public.employer_accounts(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate documents
CREATE TABLE public.candidate_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  document_type public.document_type NOT NULL,
  status public.document_status NOT NULL DEFAULT 'pending',
  access_tier public.access_tier NOT NULL DEFAULT 'candidate_only',
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_kms_key_id TEXT,
  checksum_sha256 TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES public.admin_users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document processing jobs
CREATE TABLE public.document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'queued',
  job_type TEXT NOT NULL DEFAULT 'full_pipeline',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  ocr_started_at TIMESTAMPTZ,
  ocr_completed_at TIMESTAMPTZ,
  ai_started_at TIMESTAMPTZ,
  ai_completed_at TIMESTAMPTZ,
  error_message TEXT,
  error_details JSONB,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI extraction results (raw, never shown to employers)
CREATE TABLE public.ai_extraction_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.candidate_documents(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.document_processing_jobs(id) ON DELETE SET NULL,
  raw_ocr_text TEXT,
  raw_ai_output JSONB,
  extracted_fields JSONB,
  redacted_fields JSONB,
  rewritten_cv TEXT,
  mapped_occupation_code_id UUID REFERENCES public.occupation_codes(id),
  confidence_score NUMERIC(5,2),
  model_version TEXT,
  is_admin_approved BOOLEAN NOT NULL DEFAULT FALSE,
  admin_edited_output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employer favourites
CREATE TABLE public.employer_favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES public.employer_accounts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employer_id, candidate_id)
);

-- Contact unlock requests
CREATE TABLE public.contact_unlock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES public.employer_accounts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  status public.unlock_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employer_id, candidate_id)
);

-- Candidate contact approvals (explicit consent)
CREATE TABLE public.candidate_contact_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES public.employer_accounts(id) ON DELETE CASCADE,
  unlock_request_id UUID REFERENCES public.contact_unlock_requests(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, employer_id)
);

-- Audit logs (append-only)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role public.app_role,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  employer_id UUID REFERENCES public.employer_accounts(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook configurations
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  endpoint_url TEXT,
  secret_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  event_types TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook delivery / failed job tracking
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES public.webhooks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status public.webhook_status NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Secure view: employer-visible candidate profiles only
CREATE VIEW public.employer_candidate_profiles AS
SELECT
  p.id,
  p.candidate_id,
  p.display_name,
  p.headline,
  p.summary,
  p.occupation_title,
  p.occupation_code_id,
  p.country_of_origin,
  p.years_experience,
  p.skills,
  p.qualifications_summary,
  p.availability_date,
  p.visa_stage,
  p.approved_at,
  p.updated_at
FROM public.candidate_profiles_public_redacted p
WHERE p.is_approved = TRUE;

-- Secure view: full contact details only when approval exists
CREATE VIEW public.employer_candidate_contact_details AS
SELECT
  c.id AS candidate_id,
  cca.employer_id,
  cpd.surname,
  cpd.phone,
  cpd.email,
  cpd.address_line1,
  cpd.address_line2,
  cpd.city,
  cpd.state_region,
  cpd.postal_code,
  cpd.country,
  cca.approved_at,
  cca.expires_at
FROM public.candidate_contact_approvals cca
JOIN public.candidates c ON c.id = cca.candidate_id
JOIN public.candidate_private_details cpd ON cpd.candidate_id = c.id
WHERE cca.revoked_at IS NULL
  AND (cca.expires_at IS NULL OR cca.expires_at > NOW());

-- Indexes
CREATE INDEX idx_candidates_user_id ON public.candidates(user_id);
CREATE INDEX idx_candidates_case_stage ON public.candidates(case_stage_id);
CREATE INDEX idx_candidate_documents_candidate ON public.candidate_documents(candidate_id);
CREATE INDEX idx_candidate_documents_status ON public.candidate_documents(status);
CREATE INDEX idx_document_jobs_document ON public.document_processing_jobs(document_id);
CREATE INDEX idx_document_jobs_status ON public.document_processing_jobs(status);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_subscriptions_employer ON public.subscriptions(employer_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_unlock_requests_employer ON public.contact_unlock_requests(employer_id);
CREATE INDEX idx_unlock_requests_candidate ON public.contact_unlock_requests(candidate_id);
CREATE INDEX idx_favourites_employer ON public.employer_favourites(employer_id);

-- Seed case stages
INSERT INTO public.case_stages (slug, name, description, sort_order, is_terminal) VALUES
  ('intake', 'Intake', 'Initial candidate onboarding', 1, FALSE),
  ('documents_pending', 'Documents Pending', 'Awaiting document uploads', 2, FALSE),
  ('ai_processing', 'AI Processing', 'Documents being processed', 3, FALSE),
  ('admin_review', 'Admin Review', 'Internal review queue', 4, FALSE),
  ('profile_approved', 'Profile Approved', 'Redacted profile published', 5, FALSE),
  ('employer_matching', 'Employer Matching', 'Available to employers', 6, FALSE),
  ('contact_unlocked', 'Contact Unlocked', 'Employer has contact access', 7, FALSE),
  ('placed', 'Placed', 'Successfully placed', 8, TRUE),
  ('withdrawn', 'Withdrawn', 'Candidate withdrew', 9, TRUE),
  ('rejected', 'Rejected', 'Application rejected', 10, TRUE);

-- Seed sample occupation codes (ANZSCO-style)
INSERT INTO public.occupation_codes (code, title, description, skill_level) VALUES
  ('331111', 'Bricklayer', 'Lays bricks and blocks in mortar', 3),
  ('331212', 'Carpenter', 'Constructs and repairs structures', 3),
  ('341111', 'Electrician (General)', 'Installs and maintains electrical systems', 3),
  ('322211', 'Sheetmetal Trades Worker', 'Fabricates sheet metal products', 3),
  ('323211', 'Fitter (General)', 'Fits and assembles metal parts', 3),
  ('334112', 'Plumber (General)', 'Installs and repairs plumbing systems', 3),
  ('399111', 'Welder (First Class)', 'Welds metal components', 3);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidate_private_updated_at BEFORE UPDATE ON public.candidate_private_details FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidate_profiles_updated_at BEFORE UPDATE ON public.candidate_profiles_public_redacted FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER employer_accounts_updated_at BEFORE UPDATE ON public.employer_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidate_documents_updated_at BEFORE UPDATE ON public.candidate_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER document_jobs_updated_at BEFORE UPDATE ON public.document_processing_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_results_updated_at BEFORE UPDATE ON public.ai_extraction_results FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER unlock_requests_updated_at BEFORE UPDATE ON public.contact_unlock_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER webhooks_updated_at BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER webhook_deliveries_updated_at BEFORE UPDATE ON public.webhook_deliveries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER occupation_codes_updated_at BEFORE UPDATE ON public.occupation_codes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'candidate')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
