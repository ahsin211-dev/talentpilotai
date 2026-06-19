create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.admin_role as enum ('admin', 'reviewer', 'operations');
create type public.profile_approval_status as enum ('draft', 'pending_review', 'approved', 'rejected');
create type public.document_access_tier as enum ('private', 'admin_only', 'employer_contact_approved');
create type public.document_upload_status as enum ('awaiting_upload', 'uploaded', 'processing', 'approved', 'rejected');
create type public.job_status as enum ('awaiting_upload', 'queued', 'processing', 'retrying', 'failed', 'completed');
create type public.unlock_request_status as enum ('pending', 'candidate_approved', 'candidate_rejected', 'admin_denied');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');
create type public.webhook_status as enum ('received', 'processed', 'failed');

create table public.occupation_codes (
  code text primary key,
  title text not null,
  source_system text not null default 'ANZSCO',
  created_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  given_name text not null,
  surname text not null,
  country_of_residence text not null,
  nationality text not null,
  occupation_title text not null,
  years_experience integer not null check (years_experience >= 0),
  visa_interest text not null,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_private_details (
  candidate_id uuid primary key references public.candidates (id) on delete cascade,
  email citext not null unique,
  phone text not null,
  address_line text,
  passport_number text,
  government_id_number text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.admin_role not null default 'reviewer',
  created_at timestamptz not null default now()
);

create table public.employer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  company_name text not null,
  abn text,
  website_url text,
  subscription_gate_enabled boolean not null default true,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status public.subscription_status not null,
  plan_code text not null,
  current_period_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_profiles_public_redacted (
  candidate_id uuid primary key references public.candidates (id) on delete cascade,
  display_name text not null,
  occupation_code text references public.occupation_codes (code),
  headline text not null,
  summary_redacted text not null,
  skills text[] not null default '{}'::text[],
  availability_note text,
  approval_status public.profile_approval_status not null default 'draft',
  approved_by_user_id uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  document_type text not null,
  original_file_name text not null,
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  access_tier public.document_access_tier not null default 'private',
  upload_status public.document_upload_status not null default 'awaiting_upload',
  uploaded_at timestamptz,
  approved_by_user_id uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_document_id uuid not null references public.candidate_documents (id) on delete cascade,
  status public.job_status not null default 'queued',
  provider text not null,
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_extraction_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  candidate_document_id uuid references public.candidate_documents (id) on delete cascade,
  raw_output jsonb not null default '{}'::jsonb,
  approved_output jsonb not null default '{}'::jsonb,
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),
  reviewed_by_user_id uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.employer_favourites (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table public.contact_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  rationale text not null,
  status public.unlock_request_status not null default 'pending',
  reviewed_by_user_id uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table public.candidate_contact_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.contact_unlock_requests (id) on delete cascade,
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  employer_id uuid not null references public.employer_accounts (id) on delete cascade,
  approved_by_candidate_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.case_stages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  stage_code text not null,
  stage_label text not null,
  stage_status text not null,
  notes text,
  created_by_user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_role text not null,
  action text not null,
  target_table text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null unique,
  status public.webhook_status not null default 'received',
  payload jsonb not null,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = check_user_id
  );
$$;

create or replace function public.candidate_id_for_user(check_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.candidates
  where user_id = check_user_id
  limit 1;
$$;

create or replace function public.employer_id_for_user(check_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.employer_accounts
  where user_id = check_user_id
  limit 1;
$$;

create or replace function public.employer_has_active_subscription(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.employer_accounts e on e.id = s.employer_id
    where e.user_id = check_user_id
      and s.status in ('trialing', 'active')
  );
$$;

create or replace function public.record_audit_event(
  p_action text,
  p_target_table text,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_role text;
begin
  derived_role := case
    when public.is_admin_user(auth.uid()) then 'admin'
    when public.employer_id_for_user(auth.uid()) is not null then 'employer'
    when public.candidate_id_for_user(auth.uid()) is not null then 'candidate'
    else 'system'
  end;

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    target_table,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    derived_role,
    p_action,
    p_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.assign_employer_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.employer_id is null then
    new.employer_id := public.employer_id_for_user(auth.uid());
  end if;

  if new.employer_id is null then
    raise exception 'Employer account not found for authenticated user.';
  end if;

  return new;
end;
$$;

create or replace function public.get_candidate_contact_details(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  given_name text,
  surname text,
  email citext,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer_id uuid;
begin
  v_employer_id := public.employer_id_for_user(auth.uid());

  if v_employer_id is null then
    raise exception 'Only employer users can access candidate contact data.';
  end if;

  if not exists (
    select 1
    from public.candidate_contact_approvals cca
    where cca.candidate_id = p_candidate_id
      and cca.employer_id = v_employer_id
      and cca.revoked_at is null
      and (cca.expires_at is null or cca.expires_at > now())
  ) then
    raise exception 'Candidate contact access has not been approved.';
  end if;

  perform public.record_audit_event(
    'employer.contact.accessed',
    'candidate_private_details',
    p_candidate_id::text,
    jsonb_build_object('approval_source', 'candidate_contact_approvals')
  );

  return query
  select
    c.id,
    c.given_name,
    c.surname,
    cpd.email,
    cpd.phone
  from public.candidates c
  join public.candidate_private_details cpd on cpd.candidate_id = c.id
  where c.id = p_candidate_id;
end;
$$;

create index idx_profiles_approval_status
  on public.candidate_profiles_public_redacted (approval_status);
create index idx_candidate_documents_candidate_id
  on public.candidate_documents (candidate_id);
create index idx_processing_jobs_status
  on public.document_processing_jobs (status);
create index idx_contact_unlock_requests_candidate_id
  on public.contact_unlock_requests (candidate_id);
create index idx_case_stages_candidate_id
  on public.case_stages (candidate_id);
create index idx_audit_logs_target
  on public.audit_logs (target_table, target_id);

create trigger handle_candidates_updated_at
before update on public.candidates
for each row execute function public.handle_updated_at();

create trigger handle_candidate_private_details_updated_at
before update on public.candidate_private_details
for each row execute function public.handle_updated_at();

create trigger handle_employer_accounts_updated_at
before update on public.employer_accounts
for each row execute function public.handle_updated_at();

create trigger handle_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.handle_updated_at();

create trigger handle_public_profiles_updated_at
before update on public.candidate_profiles_public_redacted
for each row execute function public.handle_updated_at();

create trigger handle_candidate_documents_updated_at
before update on public.candidate_documents
for each row execute function public.handle_updated_at();

create trigger handle_processing_jobs_updated_at
before update on public.document_processing_jobs
for each row execute function public.handle_updated_at();

create trigger handle_unlock_requests_updated_at
before update on public.contact_unlock_requests
for each row execute function public.handle_updated_at();

create trigger assign_employer_context_on_favourites
before insert on public.employer_favourites
for each row execute function public.assign_employer_context();

alter table public.candidates enable row level security;
alter table public.candidate_private_details enable row level security;
alter table public.admin_users enable row level security;
alter table public.employer_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.candidate_profiles_public_redacted enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.ai_extraction_results enable row level security;
alter table public.employer_favourites enable row level security;
alter table public.contact_unlock_requests enable row level security;
alter table public.candidate_contact_approvals enable row level security;
alter table public.case_stages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhooks enable row level security;
alter table public.occupation_codes enable row level security;

create policy candidates_candidate_own_select
on public.candidates
for select
to authenticated
using (user_id = auth.uid());

create policy candidates_candidate_own_insert
on public.candidates
for insert
to authenticated
with check (user_id = auth.uid());

create policy candidates_candidate_own_update
on public.candidates
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy candidates_admin_all
on public.candidates
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy candidate_private_details_owner_select
on public.candidate_private_details
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy candidate_private_details_owner_insert
on public.candidate_private_details
for insert
to authenticated
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_private_details_owner_update
on public.candidate_private_details
for update
to authenticated
using (candidate_id = public.candidate_id_for_user())
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_private_details_admin_all
on public.candidate_private_details
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy admin_users_admin_select
on public.admin_users
for select
to authenticated
using (public.is_admin_user());

create policy employer_accounts_owner_select
on public.employer_accounts
for select
to authenticated
using (user_id = auth.uid());

create policy employer_accounts_owner_insert
on public.employer_accounts
for insert
to authenticated
with check (user_id = auth.uid());

create policy employer_accounts_owner_update
on public.employer_accounts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy employer_accounts_admin_all
on public.employer_accounts
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy subscriptions_employer_select
on public.subscriptions
for select
to authenticated
using (employer_id = public.employer_id_for_user());

create policy subscriptions_admin_all
on public.subscriptions
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy candidate_profiles_owner_select
on public.candidate_profiles_public_redacted
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy candidate_profiles_owner_insert
on public.candidate_profiles_public_redacted
for insert
to authenticated
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_profiles_owner_update
on public.candidate_profiles_public_redacted
for update
to authenticated
using (candidate_id = public.candidate_id_for_user())
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_profiles_employer_redacted_only
on public.candidate_profiles_public_redacted
for select
to authenticated
using (
  approval_status = 'approved'
  and public.employer_has_active_subscription()
);

create policy candidate_profiles_admin_all
on public.candidate_profiles_public_redacted
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy candidate_documents_owner_select
on public.candidate_documents
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy candidate_documents_owner_insert
on public.candidate_documents
for insert
to authenticated
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_documents_owner_update
on public.candidate_documents
for update
to authenticated
using (candidate_id = public.candidate_id_for_user())
with check (candidate_id = public.candidate_id_for_user());

create policy candidate_documents_admin_all
on public.candidate_documents
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy document_processing_jobs_candidate_select
on public.document_processing_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.candidate_documents d
    where d.id = candidate_document_id
      and d.candidate_id = public.candidate_id_for_user()
  )
);

create policy document_processing_jobs_admin_all
on public.document_processing_jobs
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy ai_extraction_results_candidate_select
on public.ai_extraction_results
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy ai_extraction_results_admin_all
on public.ai_extraction_results
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy employer_favourites_employer_own_all
on public.employer_favourites
for all
to authenticated
using (employer_id = public.employer_id_for_user())
with check (employer_id = public.employer_id_for_user());

create policy employer_favourites_admin_all
on public.employer_favourites
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy contact_unlock_requests_employer_select
on public.contact_unlock_requests
for select
to authenticated
using (employer_id = public.employer_id_for_user());

create policy contact_unlock_requests_candidate_select
on public.contact_unlock_requests
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy contact_unlock_requests_employer_insert
on public.contact_unlock_requests
for insert
to authenticated
with check (
  employer_id = public.employer_id_for_user()
  and public.employer_has_active_subscription()
);

create policy contact_unlock_requests_admin_all
on public.contact_unlock_requests
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy candidate_contact_approvals_employer_select
on public.candidate_contact_approvals
for select
to authenticated
using (employer_id = public.employer_id_for_user());

create policy candidate_contact_approvals_candidate_select
on public.candidate_contact_approvals
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy candidate_contact_approvals_candidate_insert
on public.candidate_contact_approvals
for insert
to authenticated
with check (
  candidate_id = public.candidate_id_for_user()
  and approved_by_candidate_user_id = auth.uid()
);

create policy candidate_contact_approvals_admin_all
on public.candidate_contact_approvals
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy case_stages_candidate_select
on public.case_stages
for select
to authenticated
using (candidate_id = public.candidate_id_for_user());

create policy case_stages_admin_all
on public.case_stages
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

create policy audit_logs_admin_select
on public.audit_logs
for select
to authenticated
using (public.is_admin_user());

create policy webhooks_admin_select
on public.webhooks
for select
to authenticated
using (public.is_admin_user());

create policy occupation_codes_authenticated_select
on public.occupation_codes
for select
to authenticated
using (true);

create policy occupation_codes_admin_write
on public.occupation_codes
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

revoke all on function public.get_candidate_contact_details(uuid) from public;
grant execute on function public.get_candidate_contact_details(uuid) to authenticated;

insert into public.occupation_codes (code, title)
values
  ('321212', 'Diesel Motor Mechanic'),
  ('351311', 'Chef')
on conflict (code) do nothing;
