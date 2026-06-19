-- =============================================================================
-- 0006 — Secure views + privileged RPCs
-- =============================================================================

-- --- Employer browse view ----------------------------------------------------
-- security_invoker = true => RLS on the underlying redacted table still applies
-- to the querying employer. The view only projects employer-safe columns and
-- can never reference the private table.
create or replace view public.employer_candidate_cards
with (security_invoker = true) as
  select
    p.id              as profile_id,
    p.candidate_id,
    p.display_name,
    p.headline,
    p.summary,
    p.occupation_title,
    p.occupation_code_id,
    oc.code           as occupation_code,
    p.skills,
    p.years_experience,
    p.country_of_origin,
    p.availability,
    p.visa_stage,
    p.highest_qualification,
    p.created_at
  from public.candidate_profiles_public_redacted p
  left join public.occupation_codes oc on oc.id = p.occupation_code_id
  where p.is_published = true
    and p.redaction_status = 'approved';

grant select on public.employer_candidate_cards to authenticated;

-- --- Admin review queue view --------------------------------------------------
create or replace view public.admin_review_queue
with (security_invoker = true) as
  select
    r.id                as ai_result_id,
    r.candidate_id,
    r.document_id,
    r.review_status,
    r.confidence_score,
    r.suggested_occupation_code_id,
    r.created_at,
    c.status            as candidate_status,
    c.current_stage
  from public.ai_extraction_results r
  join public.candidates c on c.id = r.candidate_id
  where r.review_status = 'pending';

grant select on public.admin_review_queue to authenticated;

-- =============================================================================
-- get_unlocked_contact — THE ONLY path by which an employer can obtain a
-- candidate's contact details. Enforces, at the database layer:
--   1. caller is an employer
--   2. an explicit, non-revoked candidate_contact_approval exists
--   3. the access is audit-logged
-- SECURITY DEFINER so it can read candidate_private_details (employers have no
-- RLS policy on that table at all).
-- =============================================================================
create or replace function public.get_unlocked_contact(p_candidate_id uuid)
returns table (
  candidate_id  uuid,
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  city          text,
  state         text,
  country       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_employer_id uuid := public.current_employer_id();
begin
  if v_employer_id is null then
    raise exception 'not_an_employer' using errcode = '42501';
  end if;

  if not public.employer_has_contact_approval(p_candidate_id) then
    -- Log the denied attempt for compliance, then refuse.
    perform public.log_audit(
      'contact_unlock_denied', 'candidate_private_details', p_candidate_id::text,
      p_candidate_id, v_employer_id, '{}'::jsonb
    );
    raise exception 'contact_not_approved' using errcode = '42501';
  end if;

  perform public.log_audit(
    'contact_unlock_viewed', 'candidate_private_details', p_candidate_id::text,
    p_candidate_id, v_employer_id, '{}'::jsonb
  );

  return query
    select
      d.candidate_id, d.first_name, d.last_name, d.email::text, d.phone,
      d.city, d.state, d.country
    from public.candidate_private_details d
    where d.candidate_id = p_candidate_id;
end;
$$;

grant execute on function public.get_unlocked_contact(uuid) to authenticated, service_role;

-- =============================================================================
-- candidate_respond_to_unlock — candidate accepts/declines an employer's
-- contact request. Runs as definer so it can flip the unlock request status
-- (which the candidate has no direct RLS write access to) atomically with the
-- approval row, and record consent + a case-stage transition.
-- =============================================================================
create or replace function public.candidate_respond_to_unlock(
  p_request_id      uuid,
  p_approve         boolean,
  p_consent_text    text default null,
  p_consent_version text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate_id uuid := public.current_candidate_id();
  v_req          public.contact_unlock_requests%rowtype;
begin
  if v_candidate_id is null then
    raise exception 'not_a_candidate' using errcode = '42501';
  end if;

  select * into v_req from public.contact_unlock_requests where id = p_request_id;
  if not found or v_req.candidate_id <> v_candidate_id then
    raise exception 'request_not_found' using errcode = '42501';
  end if;

  update public.contact_unlock_requests
    set status = case when p_approve then 'approved' else 'rejected' end::unlock_status,
        decided_at = now()
    where id = p_request_id;

  insert into public.candidate_contact_approvals (
    candidate_id, employer_id, unlock_request_id, approved,
    consent_text, consent_version, approved_at
  ) values (
    v_candidate_id, v_req.employer_id, p_request_id, p_approve,
    p_consent_text, p_consent_version, case when p_approve then now() else null end
  )
  on conflict (candidate_id, employer_id) do update
    set approved = excluded.approved,
        unlock_request_id = excluded.unlock_request_id,
        consent_text = excluded.consent_text,
        consent_version = excluded.consent_version,
        approved_at = excluded.approved_at,
        revoked_at = null,
        updated_at = now();

  if p_approve then
    insert into public.case_stages (candidate_id, stage, notes)
    values (v_candidate_id, 'contact_approved', 'Candidate approved employer contact');
  end if;

  perform public.log_audit(
    case when p_approve then 'contact_request_approved' else 'contact_request_rejected' end,
    'contact_unlock_requests', p_request_id::text,
    v_candidate_id, v_req.employer_id, '{}'::jsonb
  );
end;
$$;

grant execute on function
  public.candidate_respond_to_unlock(uuid, boolean, text, text)
to authenticated, service_role;

-- =============================================================================
-- candidate_revoke_contact — candidate withdraws a previously granted approval.
-- =============================================================================
create or replace function public.candidate_revoke_contact(p_employer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate_id uuid := public.current_candidate_id();
begin
  if v_candidate_id is null then
    raise exception 'not_a_candidate' using errcode = '42501';
  end if;

  update public.candidate_contact_approvals
    set approved = false, revoked_at = now(), updated_at = now()
    where candidate_id = v_candidate_id and employer_id = p_employer_id;

  perform public.log_audit(
    'contact_approval_revoked', 'candidate_contact_approvals', null,
    v_candidate_id, p_employer_id, '{}'::jsonb
  );
end;
$$;

grant execute on function public.candidate_revoke_contact(uuid) to authenticated, service_role;
