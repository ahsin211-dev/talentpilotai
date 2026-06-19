begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('candidate', 'employer', 'admin');
create type public.document_type as enum ('cv', 'passport', 'id_document', 'qualification', 'certificate', 'other');
create type public.processing_status as enum ('pending', 'processing', 'completed', 'failed', 'needs_review');
create type public.profile_status as enum ('draft', 'pending_review', 'approved', 'rejected');
create type public.unlock_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.case_stage_kind as enum ('intake', 'document_review', 'skills_assessment', 'employer_matching', 'visa_lodgement', 'placed', 'closed');
create type public.subscription_state as enum ('inactive', 'trialing', 'active', 'past_due', 'cancelled');

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  given_name text not null,
  preferred_name text,
  country_of_origin text not null,
  current_occupation text,
  years_experience integer check (years_experience >= 0),
  availability_date date,
  consent_data_processing boolean not null default false,
  consent_marketing boolean not null default false,
  consent_terms_accepted_at timestamptz,
  profile_status public.profile_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_private_details (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  surname text not null,
  email text not null,
  phone text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postcode text,
  country text,
  passport_number text,
  passport_expiry date,
  national_id_number text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.occupation_codes (
  code text primary key,
  title text not null,
  anzsco_major_group text,
  anzsco_sub_major_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_profiles_public_redacted (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  headline text,
  professional_summary text,
  rewritten_summary text,
  key_skills text[] not null default '{}',
  years_experience integer check (years_experience >= 0),
  country text,
  availability text,
  occupation_code text references public.occupation_codes(code),
  visa_stage public.case_stage_kind not null default 'intake',
  profile_status public.profile_status not null default 'pending_review',
  confidence_score numeric(5,2),
  admin_reviewed_by uuid references auth.users(id),
  admin_reviewed_at timestamptz,
  published_at timestamptz,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  document_type public.document_type not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  s3_bucket text not null,
  s3_object_key text not null unique,
  checksum_sha256 text,
  kms_key_id text,
  processing_status public.processing_status not null default 'pending',
  upload_completed_at timestamptz,
  approved_by_admin_user_id uuid references auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_document_id uuid not null references public.candidate_documents(id) on delete cascade,
  status public.processing_status not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz,
  last_error text,
  textract_job_id text,
  claude_request_id text,
  worker_id text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_extraction_results (
  id uuid primary key default gen_random_uuid(),
  processing_job_id uuid not null references public.document_processing_jobs(id) on delete cascade,
  candidate_document_id uuid not null references public.candidate_documents(id) on delete cascade,
  extraction_version text not null default 'v1',
  raw_ocr_payload jsonb not null default '{}'::jsonb,
  raw_ai_output jsonb not null default '{}'::jsonb,
  normalized_candidate_output jsonb not null default '{}'::jsonb,
  redacted_output jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,2),
  requires_human_review boolean not null default true,
  approved_output jsonb,
  approved_by_admin_user_id uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  contact_name text not null,
  billing_email text not null,
  country text not null default 'Australia',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_favourites (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table if not exists public.contact_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  message text,
  status public.unlock_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by_admin_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table if not exists public.candidate_contact_approvals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  unlock_request_id uuid references public.contact_unlock_requests(id) on delete set null,
  status public.unlock_status not null default 'pending',
  approved_by_candidate_user_id uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, employer_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  permissions jsonb not null default '{"can_review_documents": true, "can_manage_case_stages": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_stages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  stage public.case_stage_kind not null,
  stage_status text not null default 'pending',
  notes text,
  set_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, stage)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null unique references public.employer_accounts(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  state public.subscription_state not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  signature_header text,
  delivery_status text not null default 'received',
  retry_count integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  access_level text not null default 'standard',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidates_user_id on public.candidates (user_id);
create index if not exists idx_candidate_documents_candidate_id on public.candidate_documents (candidate_id);
create index if not exists idx_candidate_documents_status on public.candidate_documents (processing_status);
create index if not exists idx_doc_jobs_document_id on public.document_processing_jobs (candidate_document_id);
create index if not exists idx_doc_jobs_status_retry on public.document_processing_jobs (status, next_retry_at);
create index if not exists idx_ai_results_doc_id on public.ai_extraction_results (candidate_document_id);
create index if not exists idx_profiles_status_visible on public.candidate_profiles_public_redacted (profile_status, is_visible, published_at desc);
create index if not exists idx_unlock_requests_candidate on public.contact_unlock_requests (candidate_id, status);
create index if not exists idx_unlock_requests_employer on public.contact_unlock_requests (employer_id, status);
create index if not exists idx_contact_approvals_candidate_employer on public.candidate_contact_approvals (candidate_id, employer_id, status);
create index if not exists idx_case_stages_candidate on public.case_stages (candidate_id, stage);
create index if not exists idx_audit_logs_resource on public.audit_logs (resource_type, resource_id, created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '');
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

create or replace function public.current_candidate_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.candidates c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_employer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.employer_accounts e
  where e.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_candidate_owner(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidates c
    where c.id = p_candidate_id
      and c.user_id = auth.uid()
  );
$$;

create or replace function public.is_employer_owner(p_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employer_accounts e
    where e.id = p_employer_id
      and e.user_id = auth.uid()
  );
$$;

create or replace function public.employer_has_contact_access(p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.candidate_contact_approvals cca
    where cca.employer_id = public.current_employer_id()
      and cca.candidate_id = p_candidate_id
      and cca.status = 'approved'
      and (cca.expires_at is null or cca.expires_at > now())
  );
$$;

create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_access_level text default 'standard'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    resource_type,
    resource_id,
    metadata,
    access_level,
    ip_address,
    user_agent
  )
  values (
    auth.uid(),
    public.current_user_role(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_access_level,
    current_setting('request.headers.x-forwarded-for', true),
    current_setting('request.headers.user-agent', true)
  );
end;
$$;

create or replace function public.audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resource_id uuid;
begin
  v_resource_id := coalesce(
    (case when tg_op = 'DELETE' then old.id else new.id end),
    null
  );

  perform public.log_audit_event(
    lower(tg_op),
    tg_table_name,
    v_resource_id,
    jsonb_build_object('table', tg_table_name),
    'sensitive'
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.get_candidate_contact_for_employer(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  given_name text,
  surname text,
  phone text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.employer_has_contact_access(p_candidate_id) then
    raise exception 'candidate contact details are not approved for this employer';
  end if;

  perform public.log_audit_event(
    'read_sensitive_contact',
    'candidate_private_details',
    p_candidate_id,
    jsonb_build_object('reason', 'approved_unlock'),
    'sensitive'
  );

  return query
  select
    c.id,
    c.given_name,
    cpd.surname,
    cpd.phone,
    cpd.email
  from public.candidates c
  join public.candidate_private_details cpd on cpd.candidate_id = c.id
  where c.id = p_candidate_id;
end;
$$;

create view public.employer_candidate_directory
with (security_invoker = true)
as
select
  cppr.candidate_id,
  cppr.headline,
  cppr.professional_summary,
  cppr.rewritten_summary,
  cppr.key_skills,
  cppr.years_experience,
  cppr.country,
  cppr.availability,
  cppr.occupation_code,
  cppr.visa_stage,
  cppr.published_at
from public.candidate_profiles_public_redacted cppr
where cppr.profile_status = 'approved'
  and cppr.is_visible = true
  and cppr.published_at is not null;

alter table public.user_roles enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_private_details enable row level security;
alter table public.occupation_codes enable row level security;
alter table public.candidate_profiles_public_redacted enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.ai_extraction_results enable row level security;
alter table public.employer_accounts enable row level security;
alter table public.employer_favourites enable row level security;
alter table public.contact_unlock_requests enable row level security;
alter table public.candidate_contact_approvals enable row level security;
alter table public.admin_users enable row level security;
alter table public.case_stages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.webhooks enable row level security;
alter table public.audit_logs enable row level security;

create policy "user_roles_self_read" on public.user_roles
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "user_roles_admin_write" on public.user_roles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "candidates_self_access" on public.candidates
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "candidate_private_self_or_admin" on public.candidate_private_details
for all to authenticated
using (public.is_candidate_owner(candidate_id) or public.is_admin())
with check (public.is_candidate_owner(candidate_id) or public.is_admin());

create policy "occupation_codes_read_authenticated" on public.occupation_codes
for select to authenticated
using (true);

create policy "occupation_codes_admin_write" on public.occupation_codes
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "candidate_profiles_candidate_or_admin" on public.candidate_profiles_public_redacted
for all to authenticated
using (public.is_candidate_owner(candidate_id) or public.is_admin())
with check (public.is_candidate_owner(candidate_id) or public.is_admin());

create policy "candidate_profiles_employer_read_approved_only" on public.candidate_profiles_public_redacted
for select to authenticated
using (
  profile_status = 'approved'
  and is_visible = true
  and published_at is not null
);

create policy "candidate_documents_candidate_or_admin" on public.candidate_documents
for all to authenticated
using (public.is_candidate_owner(candidate_id) or public.is_admin())
with check (public.is_candidate_owner(candidate_id) or public.is_admin());

create policy "processing_jobs_admin_or_doc_owner_read" on public.document_processing_jobs
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.candidate_documents cd
    where cd.id = candidate_document_id
      and public.is_candidate_owner(cd.candidate_id)
  )
);

create policy "processing_jobs_admin_write" on public.document_processing_jobs
for all to authenticated
using (public.is_admin() or public.jwt_role() = 'service_role')
with check (public.is_admin() or public.jwt_role() = 'service_role');

create policy "ai_results_admin_only" on public.ai_extraction_results
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "employer_accounts_self_or_admin" on public.employer_accounts
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "employer_favourites_own" on public.employer_favourites
for all to authenticated
using (public.is_employer_owner(employer_id) or public.is_admin())
with check (public.is_employer_owner(employer_id) or public.is_admin());

create policy "unlock_requests_visible_to_owner_candidate_admin" on public.contact_unlock_requests
for select to authenticated
using (
  public.is_employer_owner(employer_id)
  or public.is_candidate_owner(candidate_id)
  or public.is_admin()
);

create policy "unlock_requests_employer_insert" on public.contact_unlock_requests
for insert to authenticated
with check (public.is_employer_owner(employer_id));

create policy "unlock_requests_admin_update" on public.contact_unlock_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "contact_approvals_visible_to_owner_admin" on public.candidate_contact_approvals
for select to authenticated
using (
  public.is_candidate_owner(candidate_id)
  or public.is_employer_owner(employer_id)
  or public.is_admin()
);

create policy "contact_approvals_candidate_insert" on public.candidate_contact_approvals
for insert to authenticated
with check (
  public.is_candidate_owner(candidate_id)
  and approved_by_candidate_user_id = auth.uid()
);

create policy "contact_approvals_candidate_or_admin_update" on public.candidate_contact_approvals
for update to authenticated
using (public.is_candidate_owner(candidate_id) or public.is_admin())
with check (public.is_candidate_owner(candidate_id) or public.is_admin());

create policy "admin_users_admin_only" on public.admin_users
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "case_stages_candidate_read_admin_all" on public.case_stages
for select to authenticated
using (public.is_candidate_owner(candidate_id) or public.is_admin());

create policy "case_stages_admin_write" on public.case_stages
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "subscriptions_employer_read_admin_all" on public.subscriptions
for select to authenticated
using (public.is_admin() or public.is_employer_owner(employer_id));

create policy "subscriptions_admin_or_service_write" on public.subscriptions
for all to authenticated
using (public.is_admin() or public.jwt_role() = 'service_role')
with check (public.is_admin() or public.jwt_role() = 'service_role');

create policy "webhooks_admin_read" on public.webhooks
for select to authenticated
using (public.is_admin());

create policy "webhooks_admin_or_service_write" on public.webhooks
for all to authenticated
using (public.is_admin() or public.jwt_role() = 'service_role')
with check (public.is_admin() or public.jwt_role() = 'service_role');

create policy "audit_logs_admin_read" on public.audit_logs
for select to authenticated
using (public.is_admin());

create policy "audit_logs_insert_own_actor" on public.audit_logs
for insert to authenticated
with check (actor_user_id = auth.uid() or public.is_admin());

create trigger set_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();
create trigger set_candidates_updated_at
before update on public.candidates
for each row execute function public.set_updated_at();
create trigger set_candidate_private_details_updated_at
before update on public.candidate_private_details
for each row execute function public.set_updated_at();
create trigger set_occupation_codes_updated_at
before update on public.occupation_codes
for each row execute function public.set_updated_at();
create trigger set_candidate_profiles_updated_at
before update on public.candidate_profiles_public_redacted
for each row execute function public.set_updated_at();
create trigger set_candidate_documents_updated_at
before update on public.candidate_documents
for each row execute function public.set_updated_at();
create trigger set_processing_jobs_updated_at
before update on public.document_processing_jobs
for each row execute function public.set_updated_at();
create trigger set_ai_results_updated_at
before update on public.ai_extraction_results
for each row execute function public.set_updated_at();
create trigger set_employer_accounts_updated_at
before update on public.employer_accounts
for each row execute function public.set_updated_at();
create trigger set_unlock_requests_updated_at
before update on public.contact_unlock_requests
for each row execute function public.set_updated_at();
create trigger set_contact_approvals_updated_at
before update on public.candidate_contact_approvals
for each row execute function public.set_updated_at();
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();
create trigger set_case_stages_updated_at
before update on public.case_stages
for each row execute function public.set_updated_at();
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger set_webhooks_updated_at
before update on public.webhooks
for each row execute function public.set_updated_at();

create trigger audit_candidate_private_details_mutation
after insert or update or delete on public.candidate_private_details
for each row execute function public.audit_mutation();

create trigger audit_candidate_documents_mutation
after insert or update or delete on public.candidate_documents
for each row execute function public.audit_mutation();

create trigger audit_contact_unlock_requests_mutation
after insert or update or delete on public.contact_unlock_requests
for each row execute function public.audit_mutation();

create trigger audit_contact_approvals_mutation
after insert or update or delete on public.candidate_contact_approvals
for each row execute function public.audit_mutation();

create trigger audit_subscriptions_mutation
after insert or update or delete on public.subscriptions
for each row execute function public.audit_mutation();

grant execute on function public.log_audit_event(text, text, uuid, jsonb, text) to authenticated;
grant execute on function public.get_candidate_contact_for_employer(uuid) to authenticated;

commit;
