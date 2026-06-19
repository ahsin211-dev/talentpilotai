-- TalentPilot AI - Row Level Security Policies
-- CRITICAL: Employers must NEVER access unredacted candidate data without explicit approval

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_private_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles_public_redacted ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_unlock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_contact_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER for role checks)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS user_role AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.is_candidate()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'candidate';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.is_employer()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'employer';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.candidate_id()
RETURNS UUID AS $$
  SELECT id FROM public.candidates WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.employer_id()
RETURNS UUID AS $$
  SELECT id FROM public.employer_accounts WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth.has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.employer_accounts e ON e.id = s.employer_id
    WHERE e.user_id = auth.uid()
    AND s.status IN ('active', 'trialing')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check if employer has approved contact access to a candidate
CREATE OR REPLACE FUNCTION auth.has_contact_approval(p_candidate_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_contact_approvals cca
    JOIN public.employer_accounts e ON e.id = cca.employer_id
    WHERE e.user_id = auth.uid()
    AND cca.candidate_id = p_candidate_id
    AND cca.revoked_at IS NULL
    AND (cca.expires_at IS NULL OR cca.expires_at > NOW())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- user_profiles policies
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  USING (auth.is_admin());

-- candidates policies
CREATE POLICY "Candidates can read own record"
  ON candidates FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Candidates can update own record"
  ON candidates FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Candidates can insert own record"
  ON candidates FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins full access to candidates"
  ON candidates FOR ALL
  USING (auth.is_admin());

-- candidate_private_details: NEVER accessible to employers
CREATE POLICY "Candidates read own private details"
  ON candidate_private_details FOR SELECT
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates update own private details"
  ON candidate_private_details FOR UPDATE
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates insert own private details"
  ON candidate_private_details FOR INSERT
  WITH CHECK (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins full access to private details"
  ON candidate_private_details FOR ALL
  USING (auth.is_admin());

-- Employers with contact approval can read private details (explicit consent only)
CREATE POLICY "Employers read private details with approval"
  ON candidate_private_details FOR SELECT
  USING (
    auth.is_employer()
    AND auth.has_active_subscription()
    AND auth.has_contact_approval(candidate_id)
  );

-- candidate_profiles_public_redacted policies
CREATE POLICY "Candidates read own public profile"
  ON candidate_profiles_public_redacted FOR SELECT
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Employers read approved redacted profiles only"
  ON candidate_profiles_public_redacted FOR SELECT
  USING (
    auth.is_employer()
    AND auth.has_active_subscription()
    AND status = 'approved'
  );

CREATE POLICY "Admins full access to profiles"
  ON candidate_profiles_public_redacted FOR ALL
  USING (auth.is_admin());

-- candidate_documents: employers CANNOT access
CREATE POLICY "Candidates read own documents"
  ON candidate_documents FOR SELECT
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates insert own documents"
  ON candidate_documents FOR INSERT
  WITH CHECK (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins full access to documents"
  ON candidate_documents FOR ALL
  USING (auth.is_admin());

-- employer_accounts policies
CREATE POLICY "Employers read own account"
  ON employer_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Employers update own account"
  ON employer_accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Employers insert own account"
  ON employer_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins read all employer accounts"
  ON employer_accounts FOR SELECT
  USING (auth.is_admin());

-- subscriptions policies
CREATE POLICY "Employers read own subscription"
  ON subscriptions FOR SELECT
  USING (
    employer_id IN (SELECT id FROM employer_accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins read all subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.is_admin());

-- employer_favourites policies
CREATE POLICY "Employers manage own favourites"
  ON employer_favourites FOR ALL
  USING (
    auth.is_employer()
    AND auth.has_active_subscription()
    AND employer_id = auth.employer_id()
  );

CREATE POLICY "Admins read favourites"
  ON employer_favourites FOR SELECT
  USING (auth.is_admin());

-- contact_unlock_requests policies
CREATE POLICY "Employers manage own unlock requests"
  ON contact_unlock_requests FOR ALL
  USING (
    auth.is_employer()
    AND auth.has_active_subscription()
    AND employer_id = auth.employer_id()
  );

CREATE POLICY "Candidates read unlock requests for them"
  ON contact_unlock_requests FOR SELECT
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Candidates update unlock requests for them"
  ON contact_unlock_requests FOR UPDATE
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins full access to unlock requests"
  ON contact_unlock_requests FOR ALL
  USING (auth.is_admin());

-- candidate_contact_approvals policies
CREATE POLICY "Candidates manage own approvals"
  ON candidate_contact_approvals FOR ALL
  USING (
    candidate_id IN (SELECT id FROM candidates WHERE user_id = auth.uid())
  );

CREATE POLICY "Employers read own approvals"
  ON candidate_contact_approvals FOR SELECT
  USING (
    auth.is_employer()
    AND employer_id = auth.employer_id()
  );

CREATE POLICY "Admins full access to approvals"
  ON candidate_contact_approvals FOR ALL
  USING (auth.is_admin());

-- admin_users policies
CREATE POLICY "Admins read admin users"
  ON admin_users FOR SELECT
  USING (auth.is_admin());

-- case_stages: readable by all authenticated users
CREATE POLICY "Authenticated users read case stages"
  ON case_stages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage case stages"
  ON case_stages FOR ALL
  USING (auth.is_admin());

-- occupation_codes: readable by all authenticated users
CREATE POLICY "Authenticated users read occupation codes"
  ON occupation_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage occupation codes"
  ON occupation_codes FOR ALL
  USING (auth.is_admin());

-- document_processing_jobs: admin only
CREATE POLICY "Admins full access to processing jobs"
  ON document_processing_jobs FOR ALL
  USING (auth.is_admin());

-- ai_extraction_results: admin only (never employer-visible)
CREATE POLICY "Admins full access to AI results"
  ON ai_extraction_results FOR ALL
  USING (auth.is_admin());

-- audit_logs: admins read, system inserts via service role
CREATE POLICY "Admins read audit logs"
  ON audit_logs FOR SELECT
  USING (auth.is_admin());

CREATE POLICY "Users read own audit entries"
  ON audit_logs FOR SELECT
  USING (actor_id = auth.uid());

-- webhooks: admin only
CREATE POLICY "Admins read webhooks"
  ON webhooks FOR SELECT
  USING (auth.is_admin());

-- Secure view for employer candidate browsing (explicit redacted fields only)
CREATE OR REPLACE VIEW employer_candidate_profiles AS
SELECT
  p.id,
  p.candidate_id,
  p.display_first_name,
  p.professional_summary,
  p.rewritten_cv,
  p.occupation_title,
  p.skills,
  p.qualifications,
  p.years_experience,
  p.country_of_origin,
  p.availability_date,
  p.visa_stage,
  p.approved_at,
  oc.code AS occupation_code
FROM candidate_profiles_public_redacted p
LEFT JOIN occupation_codes oc ON oc.id = p.occupation_code_id
WHERE p.status = 'approved';

-- Employers can only query the view (not raw tables for browsing)
GRANT SELECT ON employer_candidate_profiles TO authenticated;

CREATE POLICY "Employers read employer view"
  ON candidate_profiles_public_redacted FOR SELECT
  USING (
    auth.is_employer()
    AND auth.has_active_subscription()
    AND status = 'approved'
  );
