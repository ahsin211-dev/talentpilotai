-- TalentPilotAI recruitment marketplace initial schema.
-- Security model:
--   1. Private candidate/contact/document data is stored separately from employer-visible redacted profiles.
--   2. Employers are not granted direct SELECT on private tables.
--   3. Approved contact access is returned by a SECURITY DEFINER function that verifies subscription and candidate approval.
--   4. Sensitive access paths write audit log rows inside the database transaction.

create extension if not exists pgcrypto;

create type public.app_role as enum ('candidate', 'employer', 'admin');
create type public.admin_role as enum ('case_manager', 'reviewer', 'compliance', 'owner');
create type public.document_type as enum ('cv', 'passport', 'id', 'qualification', 'certificate', 'other');
create type public.document_status as enum ('uploaded', 'queued', 'ocr_processing', 'ai_processing', 'needs_review', 'approved', 'rejected', 'failed');
create type public.case_stage_key as enum ('intake', 'documents_pending', 'ai_review', 'admin_review', 'employer_visible', 'contact_requested', 'contact_approved', 'placed', 'visa_case_open', 'visa_lodged', 'visa_granted', 'closed');
create type public.unlock_status as enum ('requested', 'candidate_notified', 'candidate_approved', 'candidate_rejected', 'expired', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');
create type public.webhook_status as enum ('received', 'processing', 'processed', 'failed', 'ignored');

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', '')::public.app_role;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  given_name text not null,
  country_of_residence text not null,
  primary_trade text,
  years_experience numeric(4, 1),
  availability_date date,
  consent_collected_at timestamptz,
  current_case_stage public.case_stage_key not null default 'intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_private_details (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  surname text not null,
  email text not null,
  phone text,
  whatsapp text,
  residential_address text,
  passport_number text,
  national_id_number text,
  date_of_birth date,
  emergency_contact jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.occupation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  anzsco_group text,
  trade_category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.admin_role not null default 'reviewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'admin'
    or exists (
      select 1
      from public.admin_users au
      where au.user_id = auth.uid()
        and au.is_active = true
    );
$$;

create table public.candidate_profiles_public_redacted (
  candidate_id uuid primary key references public.candidates(id) on delete cascade,
  display_name text not null,
  country_of_residence text not null,
  primary_trade text not null,
  occupation_code_id uuid references public.occupation_codes(id),
  skills text[] not null default '{}',
  qualifications text[] not null default '{}',
  years_experience numeric(4, 1),
  availability_date date,
  visa_stage public.case_stage_key not null default 'intake',
  professional_summary text not null,
  redaction_version integer not null default 1,
  approved_by uuid references public.admin_users(id),
  approved_at timestamptz,
  is_employer_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_profile_requires_approval check (
    (is_employer_visible = false)
    or (approved_by is not null and approved_at is not null)
  )
);

create table public.employer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  abn text,
  billing_email text not null,
  contact_name text not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.employer_has_active_subscription(p_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.employer_id = p_employer_id
      and s.status in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create table public.employer_favourites (
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles_public_redacted(candidate_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employer_id, candidate_id)
);

create table public.contact_unlock_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  message_to_candidate text,
  status public.unlock_status not null default 'requested',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, candidate_id)
);

create table public.candidate_contact_approvals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  employer_id uuid not null references public.employer_accounts(id) on delete cascade,
  unlock_request_id uuid references public.contact_unlock_requests(id) on delete set null,
  approved_by_candidate_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_id, employer_id)
);

create table public.case_stages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  stage public.case_stage_key not null,
  notes text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  document_type public.document_type not null,
  status public.document_status not null default 'uploaded',
  original_filename text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 15728640),
  s3_bucket text not null,
  s3_key text not null unique,
  s3_kms_key_id text not null,
  checksum_sha256 text,
  access_tier text not null default 'private' check (access_tier in ('private', 'admin_review', 'candidate_visible')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.candidate_documents(id) on delete cascade,
  status public.document_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  queued_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_extraction_results (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.candidate_documents(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  provider text not null default 'anthropic',
  provider_model text not null,
  raw_ocr_text text,
  raw_ai_output jsonb not null,
  redacted_profile jsonb,
  reviewer_confidence numeric(5, 2) check (reviewer_confidence >= 0 and reviewer_confidence <= 100),
  pii_redaction_report jsonb not null default '{}'::jsonb,
  approved_output jsonb,
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_role public.app_role,
  action text not null,
  target_table text,
  target_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  external_event_id text,
  status public.webhook_status not null default 'received',
  payload jsonb not null,
  attempts integer not null default 0,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id)
);

create index candidates_user_id_idx on public.candidates(user_id);
create index candidate_documents_candidate_id_idx on public.candidate_documents(candidate_id);
create index document_processing_jobs_status_idx on public.document_processing_jobs(status, queued_at);
create index ai_extraction_results_candidate_id_idx on public.ai_extraction_results(candidate_id);
create index candidate_profiles_visible_idx on public.candidate_profiles_public_redacted(is_employer_visible, primary_trade);
create index audit_logs_target_idx on public.audit_logs(target_table, target_id, created_at);
create index contact_unlock_requests_candidate_idx on public.contact_unlock_requests(candidate_id, status);

create trigger candidates_set_updated_at before update on public.candidates for each row execute function public.set_updated_at();
create trigger candidate_private_details_set_updated_at before update on public.candidate_private_details for each row execute function public.set_updated_at();
create trigger occupation_codes_set_updated_at before update on public.occupation_codes for each row execute function public.set_updated_at();
create trigger candidate_profiles_public_redacted_set_updated_at before update on public.candidate_profiles_public_redacted for each row execute function public.set_updated_at();
create trigger employer_accounts_set_updated_at before update on public.employer_accounts for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger contact_unlock_requests_set_updated_at before update on public.contact_unlock_requests for each row execute function public.set_updated_at();
create trigger admin_users_set_updated_at before update on public.admin_users for each row execute function public.set_updated_at();
create trigger candidate_documents_set_updated_at before update on public.candidate_documents for each row execute function public.set_updated_at();
create trigger document_processing_jobs_set_updated_at before update on public.document_processing_jobs for each row execute function public.set_updated_at();

alter table public.candidates enable row level security;
alter table public.candidate_private_details enable row level security;
alter table public.occupation_codes enable row level security;
alter table public.candidate_profiles_public_redacted enable row level security;
alter table public.employer_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.employer_favourites enable row level security;
alter table public.contact_unlock_requests enable row level security;
alter table public.candidate_contact_approvals enable row level security;
alter table public.admin_users enable row level security;
alter table public.case_stages enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.document_processing_jobs enable row level security;
alter table public.ai_extraction_results enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhooks enable row level security;

create policy "candidates_select_own_or_admin"
on public.candidates for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "candidates_insert_own"
on public.candidates for insert
to authenticated
with check (user_id = auth.uid() and public.current_app_role() = 'candidate');

create policy "candidates_update_own_or_admin"
on public.candidates for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "private_details_candidate_or_admin"
on public.candidate_private_details for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
);

create policy "occupation_codes_read_authenticated"
on public.occupation_codes for select
to authenticated
using (is_active = true or public.is_admin());

create policy "occupation_codes_admin_write"
on public.occupation_codes for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "redacted_profiles_candidate_admin_employer_read"
on public.candidate_profiles_public_redacted for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
  or (
    is_employer_visible = true
    and exists (
      select 1
      from public.employer_accounts ea
      where ea.user_id = auth.uid()
        and ea.approved_at is not null
        and public.employer_has_active_subscription(ea.id)
    )
  )
);

create policy "redacted_profiles_admin_write"
on public.candidate_profiles_public_redacted for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "employer_accounts_select_own_or_admin"
on public.employer_accounts for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "employer_accounts_insert_own"
on public.employer_accounts for insert
to authenticated
with check (user_id = auth.uid() and public.current_app_role() = 'employer');

create policy "employer_accounts_update_own_or_admin"
on public.employer_accounts for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "subscriptions_employer_own_or_admin"
on public.subscriptions for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.employer_accounts ea
    where ea.id = employer_id and ea.user_id = auth.uid()
  )
);

create policy "subscriptions_admin_write"
on public.subscriptions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "favourites_employer_own_or_admin"
on public.employer_favourites for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.employer_accounts ea
    where ea.id = employer_id and ea.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.employer_accounts ea
    where ea.id = employer_id and ea.user_id = auth.uid()
      and ea.approved_at is not null
      and public.employer_has_active_subscription(ea.id)
  )
);

create policy "unlock_requests_participant_read"
on public.contact_unlock_requests for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.employer_accounts ea
    where ea.id = employer_id and ea.user_id = auth.uid()
  )
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
);

create policy "unlock_requests_employer_insert"
on public.contact_unlock_requests for insert
to authenticated
with check (
  exists (
    select 1
    from public.employer_accounts ea
    join public.candidate_profiles_public_redacted cp on cp.candidate_id = contact_unlock_requests.candidate_id
    where ea.id = employer_id
      and ea.user_id = auth.uid()
      and ea.approved_at is not null
      and public.employer_has_active_subscription(ea.id)
      and cp.is_employer_visible = true
  )
);

create policy "unlock_requests_candidate_or_admin_update"
on public.contact_unlock_requests for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
);

create policy "contact_approvals_participant_read"
on public.candidate_contact_approvals for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.employer_accounts ea
    where ea.id = employer_id and ea.user_id = auth.uid()
  )
);

create policy "contact_approvals_candidate_or_admin_write"
on public.candidate_contact_approvals for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
);

create policy "admin_users_self_or_admin_read"
on public.admin_users for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "admin_users_admin_write"
on public.admin_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "case_stages_participant_or_admin_read"
on public.case_stages for select
to authenticated
using (
  public.is_admin()
  or changed_by = auth.uid()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
);

create policy "case_stages_admin_write"
on public.case_stages for insert
to authenticated
with check (public.is_admin());

create policy "candidate_documents_candidate_or_admin"
on public.candidate_documents for all
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id and c.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.candidates c
      where c.id = candidate_id and c.user_id = auth.uid()
    )
  )
);

create policy "processing_jobs_admin_only"
on public.document_processing_jobs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "ai_results_admin_only"
on public.ai_extraction_results for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "audit_logs_admin_read"
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy "webhooks_admin_only"
on public.webhooks for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
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
    public.current_app_role(),
    p_action,
    p_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create or replace function public.get_approved_candidate_contact(p_candidate_id uuid)
returns table (
  candidate_id uuid,
  given_name text,
  surname text,
  email text,
  phone text,
  whatsapp text,
  country_of_residence text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  employer_record public.employer_accounts%rowtype;
begin
  select *
  into employer_record
  from public.employer_accounts ea
  where ea.user_id = auth.uid()
    and ea.approved_at is not null
  limit 1;

  if employer_record.id is null then
    raise exception 'Employer account not approved or not found';
  end if;

  if not public.employer_has_active_subscription(employer_record.id) then
    raise exception 'Active employer subscription required';
  end if;

  if not exists (
    select 1
    from public.candidate_contact_approvals cca
    where cca.candidate_id = p_candidate_id
      and cca.employer_id = employer_record.id
      and cca.revoked_at is null
      and (cca.expires_at is null or cca.expires_at > now())
  ) then
    raise exception 'Candidate contact approval required';
  end if;

  perform public.write_audit_log(
    'employer_contact_details_accessed',
    'candidate_private_details',
    p_candidate_id,
    jsonb_build_object('employer_id', employer_record.id)
  );

  return query
  select
    c.id,
    c.given_name,
    cpd.surname,
    cpd.email,
    cpd.phone,
    cpd.whatsapp,
    c.country_of_residence
  from public.candidates c
  join public.candidate_private_details cpd on cpd.candidate_id = c.id
  where c.id = p_candidate_id;
end;
$$;

revoke all on public.candidate_private_details from anon, authenticated;
revoke all on public.candidate_documents from anon, authenticated;
revoke all on public.ai_extraction_results from anon, authenticated;
grant select, insert, update on public.candidates to authenticated;
grant select, insert, update on public.candidate_private_details to authenticated;
grant select on public.occupation_codes to authenticated;
grant select on public.candidate_profiles_public_redacted to authenticated;
grant insert, update, delete on public.candidate_profiles_public_redacted to authenticated;
grant select, insert, update on public.employer_accounts to authenticated;
grant select on public.subscriptions to authenticated;
grant insert, update, delete on public.employer_favourites to authenticated;
grant select, insert, update on public.contact_unlock_requests to authenticated;
grant select, insert, update on public.candidate_contact_approvals to authenticated;
grant select on public.admin_users to authenticated;
grant select on public.case_stages to authenticated;
grant select, insert, update on public.candidate_documents to authenticated;
grant execute on function public.get_approved_candidate_contact(uuid) to authenticated;
grant execute on function public.write_audit_log(text, text, uuid, jsonb) to authenticated;
