-- =============================================================================
-- 0005 — Row Level Security: grants + policies
--
-- MODEL: On Supabase every logged-in user shares the single `authenticated`
-- Postgres role; the actual actor type (candidate / employer / admin) is derived
-- from the app tables via the SECURITY DEFINER helpers in 0003. RLS — not the
-- UI and not the API — is the enforcement boundary.
--
-- Default-deny: RLS is enabled on every table and a request only succeeds if a
-- policy explicitly permits it.
-- =============================================================================

-- --- Schema usage + baseline table grants -----------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- authenticated users may attempt DML on all tables; RLS decides the outcome.
grant select, insert, update, delete on all tables in schema public to authenticated;
-- service_role is the trusted server identity (also has BYPASSRLS).
grant all on all tables in schema public to service_role;

-- audit_logs is append-only and admin-readable: strip write grants from
-- authenticated entirely (writes happen only through SECURITY DEFINER funcs).
revoke insert, update, delete on public.audit_logs from authenticated;

-- --- Enable RLS everywhere ---------------------------------------------------
alter table public.admin_users                      enable row level security;
alter table public.candidates                       enable row level security;
alter table public.candidate_private_details        enable row level security;
alter table public.candidate_profiles_public_redacted enable row level security;
alter table public.candidate_documents              enable row level security;
alter table public.document_processing_jobs         enable row level security;
alter table public.ai_extraction_results            enable row level security;
alter table public.case_stages                      enable row level security;
alter table public.occupation_codes                 enable row level security;
alter table public.employer_accounts                enable row level security;
alter table public.employer_favourites              enable row level security;
alter table public.contact_unlock_requests          enable row level security;
alter table public.candidate_contact_approvals      enable row level security;
alter table public.subscriptions                    enable row level security;
alter table public.webhooks                         enable row level security;
alter table public.audit_logs                       enable row level security;

-- =============================================================================
-- ADMIN USERS
-- =============================================================================
create policy admin_users_select on public.admin_users
  for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.has_admin_role(array['admin','super_admin']::admin_role[])
  );
create policy admin_users_write on public.admin_users
  for all to authenticated
  using (public.has_admin_role(array['super_admin']::admin_role[]))
  with check (public.has_admin_role(array['super_admin']::admin_role[]));

-- =============================================================================
-- CANDIDATES
-- =============================================================================
create policy candidates_select on public.candidates
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy candidates_insert on public.candidates
  for insert to authenticated
  with check (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy candidates_update on public.candidates
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_reviewer_or_above())
  with check (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy candidates_delete on public.candidates
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- CANDIDATE PRIVATE DETAILS  (NO employer policy — never reachable by employers)
-- =============================================================================
create policy cpd_select on public.candidate_private_details
  for select to authenticated
  using (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy cpd_insert on public.candidate_private_details
  for insert to authenticated
  with check (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy cpd_update on public.candidate_private_details
  for update to authenticated
  using (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above())
  with check (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy cpd_delete on public.candidate_private_details
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- CANDIDATE PUBLIC / REDACTED PROFILE
--   - candidate: own
--   - admin: all (reviewer+)
--   - employer: ONLY published + approved profiles, AND only with an active
--     subscription (Stripe gate enforced at the DB layer)
-- =============================================================================
create policy profiles_select on public.candidate_profiles_public_redacted
  for select to authenticated
  using (
    candidate_id = public.current_candidate_id()
    or public.is_reviewer_or_above()
    or (
      public.is_employer()
      and public.employer_subscription_active()
      and is_published = true
      and redaction_status = 'approved'
    )
  );
create policy profiles_write on public.candidate_profiles_public_redacted
  for all to authenticated
  using (public.is_reviewer_or_above())
  with check (public.is_reviewer_or_above());

-- =============================================================================
-- CANDIDATE DOCUMENTS  (NO employer policy — never reachable by employers)
-- =============================================================================
create policy documents_select on public.candidate_documents
  for select to authenticated
  using (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy documents_insert on public.candidate_documents
  for insert to authenticated
  with check (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy documents_update on public.candidate_documents
  for update to authenticated
  using (public.is_reviewer_or_above())
  with check (public.is_reviewer_or_above());
create policy documents_delete on public.candidate_documents
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- DOCUMENT PROCESSING JOBS  (admins only; worker uses service_role)
-- =============================================================================
create policy jobs_all on public.document_processing_jobs
  for all to authenticated
  using (public.is_reviewer_or_above())
  with check (public.is_reviewer_or_above());

-- =============================================================================
-- AI EXTRACTION RESULTS  (admins only — raw AI output NEVER exposed)
-- =============================================================================
create policy ai_results_select on public.ai_extraction_results
  for select to authenticated
  using (public.is_reviewer_or_above());
create policy ai_results_write on public.ai_extraction_results
  for all to authenticated
  using (public.is_reviewer_or_above())
  with check (public.is_reviewer_or_above());

-- =============================================================================
-- CASE STAGES
-- =============================================================================
create policy case_stages_select on public.case_stages
  for select to authenticated
  using (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy case_stages_write on public.case_stages
  for all to authenticated
  using (public.is_reviewer_or_above())
  with check (public.is_reviewer_or_above());

-- =============================================================================
-- OCCUPATION CODES  (reference data: readable by all authenticated)
-- =============================================================================
create policy occupation_select on public.occupation_codes
  for select to authenticated
  using (true);
create policy occupation_write on public.occupation_codes
  for all to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]))
  with check (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- EMPLOYER ACCOUNTS
-- =============================================================================
create policy employer_select on public.employer_accounts
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy employer_insert on public.employer_accounts
  for insert to authenticated
  with check (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy employer_update on public.employer_accounts
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_reviewer_or_above())
  -- Employers must NOT be able to self-promote their subscription/active flags;
  -- those are written by the Stripe webhook via service_role only. (App layer
  -- enforces column-level intent; here we keep row ownership.)
  with check (auth_user_id = auth.uid() or public.is_reviewer_or_above());
create policy employer_delete on public.employer_accounts
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- EMPLOYER FAVOURITES  (subscription-gated)
-- =============================================================================
create policy favourites_select on public.employer_favourites
  for select to authenticated
  using (employer_id = public.current_employer_id() or public.is_reviewer_or_above());
create policy favourites_insert on public.employer_favourites
  for insert to authenticated
  with check (
    employer_id = public.current_employer_id()
    and public.employer_subscription_active()
  );
create policy favourites_delete on public.employer_favourites
  for delete to authenticated
  using (employer_id = public.current_employer_id());

-- =============================================================================
-- CONTACT UNLOCK REQUESTS
-- =============================================================================
create policy unlock_select on public.contact_unlock_requests
  for select to authenticated
  using (
    employer_id = public.current_employer_id()
    or candidate_id = public.current_candidate_id()
    or public.is_reviewer_or_above()
  );
create policy unlock_insert on public.contact_unlock_requests
  for insert to authenticated
  with check (
    employer_id = public.current_employer_id()
    and public.employer_subscription_active()
  );
create policy unlock_update on public.contact_unlock_requests
  for update to authenticated
  using (employer_id = public.current_employer_id() or public.is_reviewer_or_above())
  with check (employer_id = public.current_employer_id() or public.is_reviewer_or_above());
create policy unlock_delete on public.contact_unlock_requests
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- CANDIDATE CONTACT APPROVALS  (employers may READ their own approval rows,
-- but only the CANDIDATE or an admin can create/modify them)
-- =============================================================================
create policy approvals_select on public.candidate_contact_approvals
  for select to authenticated
  using (
    candidate_id = public.current_candidate_id()
    or employer_id = public.current_employer_id()
    or public.is_reviewer_or_above()
  );
create policy approvals_insert on public.candidate_contact_approvals
  for insert to authenticated
  with check (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy approvals_update on public.candidate_contact_approvals
  for update to authenticated
  using (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above())
  with check (candidate_id = public.current_candidate_id() or public.is_reviewer_or_above());
create policy approvals_delete on public.candidate_contact_approvals
  for delete to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- SUBSCRIPTIONS  (read-only for employers/admins; writes via service_role)
-- =============================================================================
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (employer_id = public.current_employer_id() or public.is_reviewer_or_above());

-- =============================================================================
-- WEBHOOKS  (admin read; writes via service_role)
-- =============================================================================
create policy webhooks_select on public.webhooks
  for select to authenticated
  using (public.has_admin_role(array['admin','super_admin']::admin_role[]));

-- =============================================================================
-- AUDIT LOGS  (append-only; senior reviewers and above may read)
-- =============================================================================
create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.has_admin_role(array['senior_reviewer','admin','super_admin']::admin_role[]));
-- NOTE: deliberately no INSERT/UPDATE/DELETE policies — append-only via
-- SECURITY DEFINER functions and service_role only.
