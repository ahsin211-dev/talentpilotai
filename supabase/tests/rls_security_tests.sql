-- Static security regression checks for RLS and audit controls.
-- Run with: psql "$SUPABASE_DB_URL" -f supabase/tests/rls_security_tests.sql

begin;

do $$
declare
  table_name text;
  secured_tables text[] := array[
    'candidates',
    'candidate_private_details',
    'candidate_profiles_public_redacted',
    'candidate_documents',
    'document_processing_jobs',
    'ai_extraction_results',
    'employer_accounts',
    'employer_favourites',
    'contact_unlock_requests',
    'candidate_contact_approvals',
    'case_stages',
    'subscriptions',
    'webhooks',
    'audit_logs'
  ];
begin
  foreach table_name in array secured_tables
  loop
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity = true
    ) then
      raise exception 'RLS not enabled on public.%', table_name;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_private_details'
      and qual ilike '%is_employer_owner%'
  ) then
    raise exception 'candidate_private_details should not expose employer access policy';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_profiles_public_redacted'
      and policyname = 'candidate_profiles_employer_read_approved_only'
      and qual ilike '%profile_status = ''approved''%'
      and qual ilike '%is_visible = true%'
  ) then
    raise exception 'Missing strict employer redacted profile policy';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_candidate_contact_for_employer'
      and p.prosecdef = true
  ) then
    raise exception 'Expected get_candidate_contact_for_employer to be SECURITY DEFINER';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'candidate_private_details'
      and t.tgname = 'audit_candidate_private_details_mutation'
      and not t.tgisinternal
  ) then
    raise exception 'Missing audit trigger on candidate_private_details';
  end if;
end $$;

rollback;
