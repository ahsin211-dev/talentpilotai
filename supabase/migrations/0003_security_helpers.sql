-- =============================================================================
-- 0003 — Security helper functions
--
-- These classify the *current* authenticated user (candidate / employer / admin)
-- by consulting the app tables. They are SECURITY DEFINER with a pinned
-- search_path so that:
--   (a) they bypass RLS on the lookup tables (otherwise RLS policies that call
--       these helpers would recurse infinitely), and
--   (b) they cannot be hijacked via a mutable search_path.
-- They are the single source of truth for "who is this caller" in every policy.
-- =============================================================================

-- Resolve the current candidate row id (or NULL).
create or replace function public.current_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.candidates c where c.auth_user_id = auth.uid()
$$;

-- Resolve the current employer row id (active accounts only) (or NULL).
create or replace function public.current_employer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id
  from public.employer_accounts e
  where e.auth_user_id = auth.uid()
    and e.is_active
$$;

-- Resolve the current admin row id (active only) (or NULL).
create or replace function public.current_admin_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id
  from public.admin_users a
  where a.auth_user_id = auth.uid()
    and a.is_active
$$;

create or replace function public.is_candidate()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.current_candidate_id() is not null $$;

create or replace function public.is_employer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.current_employer_id() is not null $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.current_admin_id() is not null $$;

-- Does the current admin hold one of the supplied roles?
create or replace function public.has_admin_role(required admin_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.auth_user_id = auth.uid()
      and a.is_active
      and a.role = any (required)
  )
$$;

-- Reviewer-or-above (reviewer, senior_reviewer, admin, super_admin).
create or replace function public.is_reviewer_or_above()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_admin_role(
    array['reviewer','senior_reviewer','admin','super_admin']::admin_role[]
  )
$$;

-- Does the current employer hold an explicit, non-revoked contact approval for
-- the given candidate? This is the gate for any contact-detail access.
create or replace function public.employer_has_contact_approval(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.candidate_contact_approvals a
    where a.candidate_id = p_candidate_id
      and a.employer_id = public.current_employer_id()
      and a.approved
      and a.revoked_at is null
  )
$$;

-- Is the current employer's subscription active/trialing? Used to gate
-- employer features at the database layer (defence in depth with Stripe).
create or replace function public.employer_subscription_active()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employer_accounts e
    where e.auth_user_id = auth.uid()
      and e.is_active
      and e.subscription_status in ('active','trialing')
  )
$$;

-- Lock down EXECUTE: only the API roles may call these (never anon-by-default
-- relies on this, but explicit grants document intent).
grant execute on function
  public.current_candidate_id(),
  public.current_employer_id(),
  public.current_admin_id(),
  public.is_candidate(),
  public.is_employer(),
  public.is_admin(),
  public.has_admin_role(admin_role[]),
  public.is_reviewer_or_above(),
  public.employer_has_contact_approval(uuid),
  public.employer_subscription_active()
to authenticated, service_role;
