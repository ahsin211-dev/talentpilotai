-- TalentPilot AI: Row Level Security policies
-- CRITICAL: Employer access to unredacted data is blocked at DB level

-- Helper functions (SECURITY DEFINER, stable)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN public.profiles p ON p.id = au.user_id
    WHERE au.user_id = auth.uid() AND au.is_active = TRUE AND p.role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_employer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'employer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_candidate()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'candidate'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_candidate_id()
RETURNS UUID AS $$
  SELECT id FROM public.candidates WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_employer_id()
RETURNS UUID AS $$
  SELECT id FROM public.employer_accounts WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_employer_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.employer_id = COALESCE(p_employer_id, public.get_employer_id())
      AND s.status IN ('active', 'trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_contact_approval(p_candidate_id UUID, p_employer_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_contact_approvals cca
    WHERE cca.candidate_id = p_candidate_id
      AND cca.employer_id = COALESCE(p_employer_id, public.get_employer_id())
      AND cca.revoked_at IS NULL
      AND (cca.expires_at IS NULL OR cca.expires_at > NOW())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_private_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles_public_redacted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_unlock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_contact_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- admin_users: admins only
CREATE POLICY admin_users_admin_all ON public.admin_users FOR ALL USING (public.is_admin());

-- occupation_codes: read for authenticated, write for admin
CREATE POLICY occupation_codes_select ON public.occupation_codes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY occupation_codes_admin_write ON public.occupation_codes FOR ALL USING (public.is_admin());

-- case_stages: read for authenticated, write for admin
CREATE POLICY case_stages_select ON public.case_stages FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY case_stages_admin_write ON public.case_stages FOR ALL USING (public.is_admin());

-- candidates
CREATE POLICY candidates_select_own ON public.candidates FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY candidates_insert_own ON public.candidates FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_candidate());
CREATE POLICY candidates_update_own ON public.candidates FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());

-- candidate_private_details: NEVER accessible to employers
CREATE POLICY private_details_candidate ON public.candidate_private_details FOR ALL
  USING (
    candidate_id = public.get_candidate_id() OR public.is_admin()
  )
  WITH CHECK (
    candidate_id = public.get_candidate_id() OR public.is_admin()
  );

-- Employers may read contact details ONLY with explicit approval (separate policy for SELECT)
CREATE POLICY private_details_employer_approved ON public.candidate_private_details FOR SELECT
  USING (
    public.is_employer()
    AND public.has_active_subscription()
    AND public.has_contact_approval(candidate_id)
  );

-- candidate_profiles_public_redacted
CREATE POLICY redacted_profile_candidate ON public.candidate_profiles_public_redacted FOR ALL
  USING (candidate_id = public.get_candidate_id() OR public.is_admin())
  WITH CHECK (candidate_id = public.get_candidate_id() OR public.is_admin());

-- Employers: only approved redacted profiles, with active subscription
CREATE POLICY redacted_profile_employer_select ON public.candidate_profiles_public_redacted FOR SELECT
  USING (
    public.is_employer()
    AND public.has_active_subscription()
    AND is_approved = TRUE
  );

-- employer_accounts
CREATE POLICY employer_accounts_own ON public.employer_accounts FOR ALL
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- subscriptions
CREATE POLICY subscriptions_employer ON public.subscriptions FOR SELECT
  USING (
    employer_id = public.get_employer_id() OR public.is_admin()
  );
CREATE POLICY subscriptions_admin_write ON public.subscriptions FOR ALL
  USING (public.is_admin());

-- candidate_documents: candidates see own, admins see all, employers NEVER
CREATE POLICY documents_candidate ON public.candidate_documents FOR ALL
  USING (candidate_id = public.get_candidate_id() OR public.is_admin())
  WITH CHECK (candidate_id = public.get_candidate_id() OR public.is_admin());

-- document_processing_jobs: candidate (via document), admin only
CREATE POLICY jobs_candidate ON public.document_processing_jobs FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.candidate_documents d
      WHERE d.id = document_id AND d.candidate_id = public.get_candidate_id()
    )
  );
CREATE POLICY jobs_admin_write ON public.document_processing_jobs FOR ALL
  USING (public.is_admin());

-- ai_extraction_results: admin and candidate (own docs) only — NEVER employers
CREATE POLICY ai_results_access ON public.ai_extraction_results FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.candidate_documents d
      WHERE d.id = document_id AND d.candidate_id = public.get_candidate_id()
    )
  );
CREATE POLICY ai_results_admin_write ON public.ai_extraction_results FOR ALL
  USING (public.is_admin());

-- employer_favourites
CREATE POLICY favourites_employer ON public.employer_favourites FOR ALL
  USING (
    (employer_id = public.get_employer_id() AND public.has_active_subscription())
    OR public.is_admin()
  )
  WITH CHECK (
    employer_id = public.get_employer_id() AND public.has_active_subscription()
  );

-- contact_unlock_requests
CREATE POLICY unlock_employer ON public.contact_unlock_requests FOR ALL
  USING (
    (employer_id = public.get_employer_id() AND public.has_active_subscription())
    OR public.is_admin()
  )
  WITH CHECK (
    employer_id = public.get_employer_id() AND public.has_active_subscription()
  );

CREATE POLICY unlock_candidate_select ON public.contact_unlock_requests FOR SELECT
  USING (candidate_id = public.get_candidate_id());

CREATE POLICY unlock_candidate_update ON public.contact_unlock_requests FOR UPDATE
  USING (candidate_id = public.get_candidate_id());

-- candidate_contact_approvals
CREATE POLICY approvals_candidate ON public.candidate_contact_approvals FOR ALL
  USING (candidate_id = public.get_candidate_id() OR public.is_admin())
  WITH CHECK (candidate_id = public.get_candidate_id() OR public.is_admin());

CREATE POLICY approvals_employer_select ON public.candidate_contact_approvals FOR SELECT
  USING (
    employer_id = public.get_employer_id()
    AND public.has_active_subscription()
  );

-- audit_logs: admins read, authenticated insert via service (append-only for users)
CREATE POLICY audit_logs_admin_select ON public.audit_logs FOR SELECT USING (public.is_admin());
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid() OR public.is_admin());

-- webhooks: admin only
CREATE POLICY webhooks_admin ON public.webhooks FOR ALL USING (public.is_admin());
CREATE POLICY webhook_deliveries_admin ON public.webhook_deliveries FOR ALL USING (public.is_admin());

-- Secure views: grant select to authenticated, enforce via underlying RLS + view filters
GRANT SELECT ON public.employer_candidate_profiles TO authenticated;
GRANT SELECT ON public.employer_candidate_contact_details TO authenticated;

-- Revoke direct access to sensitive tables from anon
REVOKE ALL ON public.candidate_private_details FROM anon;
REVOKE ALL ON public.ai_extraction_results FROM anon;
REVOKE ALL ON public.candidate_documents FROM anon;

-- Service role bypasses RLS (server-side only) — never expose service key to client
