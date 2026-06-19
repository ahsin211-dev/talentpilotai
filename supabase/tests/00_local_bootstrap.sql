-- =============================================================================
-- LOCAL BOOTSTRAP (TEST / DEV ONLY) — NOT a Supabase migration.
--
-- Supabase hosts already provide the `auth` schema, the `auth.uid()/jwt()/role()`
-- helper functions, and the `anon` / `authenticated` / `service_role` roles.
-- This file recreates an *equivalent* environment on a plain PostgreSQL instance
-- so the exact same migrations + RLS policies can be exercised by the automated
-- security test-suite. It must NEVER run against a real Supabase project.
-- =============================================================================

-- --- Roles (idempotent) ------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    -- service_role bypasses RLS, exactly like on Supabase.
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- --- auth schema + JWT helpers (mirror Supabase semantics) -------------------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- auth.uid(): the `sub` claim of the current request's JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid
$$;

-- auth.role(): the `role` claim, defaulting to anon.
create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    'anon'
  )
$$;

-- auth.jwt(): the full claims object.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
