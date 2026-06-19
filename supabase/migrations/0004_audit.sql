-- =============================================================================
-- 0004 — Audit logging
--
-- Two complementary mechanisms:
--   1. public.log_audit(...)  — SECURITY DEFINER RPC the application calls to
--      record *read* / access events (e.g. signed-URL issuance, employer
--      profile views, contact unlocks). PostgreSQL has no SELECT triggers, so
--      sensitive reads are logged explicitly from the privileged server layer.
--   2. AFTER write triggers on sensitive tables — guarantee that every
--      INSERT/UPDATE/DELETE is captured even if the app forgets to log.
--
-- audit_logs is append-only: there are no UPDATE/DELETE policies anywhere.
-- =============================================================================

-- Application-callable audit writer. Runs as definer so it can insert into the
-- otherwise locked-down audit_logs table regardless of the caller's role.
create or replace function public.log_audit(
  p_action        text,
  p_resource_type text default null,
  p_resource_id   text default null,
  p_candidate_id  uuid default null,
  p_employer_id   uuid default null,
  p_metadata      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (
    actor_auth_user_id, actor_role, action, resource_type, resource_id,
    candidate_id, employer_id, metadata
  ) values (
    auth.uid(), auth.role(), p_action, p_resource_type, p_resource_id,
    p_candidate_id, p_employer_id, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute on function
  public.log_audit(text, text, text, uuid, uuid, jsonb)
to authenticated, service_role;

-- Generic write-audit trigger for sensitive tables.
create or replace function public.audit_table_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_candidate_id uuid;
  v_resource_id  text;
begin
  -- Best-effort extraction of candidate_id and primary key for context.
  begin
    v_candidate_id := coalesce(
      (to_jsonb(new) ->> 'candidate_id')::uuid,
      (to_jsonb(old) ->> 'candidate_id')::uuid
    );
  exception when others then
    v_candidate_id := null;
  end;

  v_resource_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  insert into public.audit_logs (
    actor_auth_user_id, actor_role, action, resource_type, resource_id,
    candidate_id, metadata
  ) values (
    auth.uid(),
    auth.role(),
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    v_resource_id,
    v_candidate_id,
    jsonb_build_object('op', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Attach the write-audit trigger to the most sensitive tables.
drop trigger if exists trg_audit_private_details on public.candidate_private_details;
create trigger trg_audit_private_details
  after insert or update or delete on public.candidate_private_details
  for each row execute function public.audit_table_write();

drop trigger if exists trg_audit_documents on public.candidate_documents;
create trigger trg_audit_documents
  after insert or update or delete on public.candidate_documents
  for each row execute function public.audit_table_write();

drop trigger if exists trg_audit_ai_results on public.ai_extraction_results;
create trigger trg_audit_ai_results
  after insert or update or delete on public.ai_extraction_results
  for each row execute function public.audit_table_write();

drop trigger if exists trg_audit_approvals on public.candidate_contact_approvals;
create trigger trg_audit_approvals
  after insert or update or delete on public.candidate_contact_approvals
  for each row execute function public.audit_table_write();

drop trigger if exists trg_audit_unlock_requests on public.contact_unlock_requests;
create trigger trg_audit_unlock_requests
  after insert or update or delete on public.contact_unlock_requests
  for each row execute function public.audit_table_write();
