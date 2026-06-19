-- TalentPilot AI - Initial Schema
-- Production recruitment marketplace with strict data separation

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('candidate', 'employer', 'admin');
CREATE TYPE document_type AS ENUM ('cv', 'passport', 'id', 'qualification', 'consent', 'other');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'review_required', 'approved', 'rejected');
CREATE TYPE profile_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'archived');
CREATE TYPE unlock_request_status AS ENUM ('pending', 'candidate_pending', 'approved', 'rejected', 'expired');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'retrying');
CREATE TYPE access_tier AS ENUM ('candidate_only', 'admin_only', 'employer_redacted', 'employer_full');

-- User profiles (links to auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case stages reference table
CREATE TABLE case_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Occupation codes (ANZSCO or agency-specific)
CREATE TABLE occupation_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  skill_level INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidates (core record)
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  case_stage_id UUID REFERENCES case_stages(id),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  consent_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private candidate details (NEVER exposed to employers without approval)
CREATE TABLE candidate_private_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  surname TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT,
  passport_number TEXT,
  passport_country TEXT,
  passport_expiry DATE,
  id_number TEXT,
  id_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public redacted profiles (employer-visible after admin approval)
CREATE TABLE candidate_profiles_public_redacted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  display_first_name TEXT NOT NULL,
  professional_summary TEXT,
  rewritten_cv TEXT,
  occupation_code_id UUID REFERENCES occupation_codes(id),
  occupation_title TEXT,
  skills TEXT[] DEFAULT '{}',
  qualifications TEXT[] DEFAULT '{}',
  years_experience INT,
  country_of_origin TEXT,
  availability_date DATE,
  visa_stage TEXT,
  status profile_status NOT NULL DEFAULT 'draft',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate documents
CREATE TABLE candidate_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  s3_bucket TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_version_id TEXT,
  access_tier access_tier NOT NULL DEFAULT 'candidate_only',
  status document_status NOT NULL DEFAULT 'pending',
  checksum_sha256 TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employer accounts
CREATE TABLE employer_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  abn TEXT,
  industry TEXT,
  contact_first_name TEXT NOT NULL,
  contact_surname TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (Stripe)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL UNIQUE REFERENCES employer_accounts(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employer favourites
CREATE TABLE employer_favourites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employer_id, candidate_id)
);

-- Contact unlock requests
CREATE TABLE contact_unlock_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message TEXT,
  status unlock_request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate contact approvals (explicit consent for employer access)
CREATE TABLE candidate_contact_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unlock_request_id UUID NOT NULL UNIQUE REFERENCES contact_unlock_requests(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES employer_accounts(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  admin_role TEXT NOT NULL DEFAULT 'reviewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document processing jobs
CREATE TABLE document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES candidate_documents(id) ON DELETE CASCADE,
  status job_status NOT NULL DEFAULT 'queued',
  job_type TEXT NOT NULL DEFAULT 'full_pipeline',
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI extraction results (raw AI output, never directly employer-visible)
CREATE TABLE ai_extraction_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES candidate_documents(id) ON DELETE CASCADE,
  job_id UUID REFERENCES document_processing_jobs(id),
  raw_ocr_text TEXT,
  raw_ai_output JSONB,
  extracted_fields JSONB,
  redacted_fields JSONB,
  confidence_score NUMERIC(5,2),
  is_admin_approved BOOLEAN NOT NULL DEFAULT FALSE,
  admin_edited_fields JSONB,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES auth.users(id),
  actor_role user_role,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhooks (integration events)
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  attempt_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_candidates_user_id ON candidates(user_id);
CREATE INDEX idx_candidate_documents_candidate_id ON candidate_documents(candidate_id);
CREATE INDEX idx_candidate_documents_status ON candidate_documents(status);
CREATE INDEX idx_profiles_status ON candidate_profiles_public_redacted(status);
CREATE INDEX idx_profiles_occupation ON candidate_profiles_public_redacted(occupation_code_id);
CREATE INDEX idx_employer_favourites_employer ON employer_favourites(employer_id);
CREATE INDEX idx_unlock_requests_employer ON contact_unlock_requests(employer_id);
CREATE INDEX idx_unlock_requests_candidate ON contact_unlock_requests(candidate_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_processing_jobs_status ON document_processing_jobs(status);
CREATE INDEX idx_contact_approvals_employer_candidate ON candidate_contact_approvals(employer_id, candidate_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER tr_user_profiles_updated BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_candidates_updated BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_private_details_updated BEFORE UPDATE ON candidate_private_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON candidate_profiles_public_redacted FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_documents_updated BEFORE UPDATE ON candidate_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_employer_accounts_updated BEFORE UPDATE ON employer_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_unlock_requests_updated BEFORE UPDATE ON contact_unlock_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_admin_users_updated BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_processing_jobs_updated BEFORE UPDATE ON document_processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_ai_results_updated BEFORE UPDATE ON ai_extraction_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed case stages
INSERT INTO case_stages (code, name, description, sort_order) VALUES
  ('intake', 'Intake', 'Initial candidate onboarding', 1),
  ('documents_pending', 'Documents Pending', 'Awaiting document uploads', 2),
  ('documents_review', 'Documents Under Review', 'Admin reviewing documents', 3),
  ('profile_building', 'Profile Building', 'AI processing and profile creation', 4),
  ('profile_review', 'Profile Review', 'Admin reviewing redacted profile', 5),
  ('published', 'Published', 'Profile visible to employers', 6),
  ('contact_unlocked', 'Contact Unlocked', 'Employer has contact access', 7),
  ('placed', 'Placed', 'Successfully placed with employer', 8),
  ('closed', 'Closed', 'Case closed', 9);

-- Seed sample occupation codes (ANZSCO subset)
INSERT INTO occupation_codes (code, title, description, skill_level) VALUES
  ('331111', 'Bricklayer', 'Lays bricks, pre-cut stones and other types of building blocks', 3),
  ('331112', 'Stonemason', 'Cuts and shapes stone for construction', 3),
  ('331211', 'Carpenter', 'Constructs and repairs wooden structures', 3),
  ('331212', 'Carpenter and Joiner', 'Constructs and installs wooden fixtures', 3),
  ('331213', 'Joiner', 'Makes and installs wooden joinery', 3),
  ('334111', 'Plumber (General)', 'Installs and repairs water, gas and drainage systems', 3),
  ('341111', 'Electrician (General)', 'Installs and maintains electrical systems', 3),
  ('342111', 'Airconditioning and Refrigeration Mechanic', 'Installs and repairs AC and refrigeration', 3),
  ('351311', 'Chef', 'Plans and prepares food in commercial kitchens', 2),
  ('323111', 'Motor Mechanic (General)', 'Maintains and repairs motor vehicles', 3);
