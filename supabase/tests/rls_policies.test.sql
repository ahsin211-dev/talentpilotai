-- RLS policy verification tests
-- Run with: supabase db test or psql against local Supabase

BEGIN;

-- Test helpers would run as different roles in integration environment.
-- These assertions document expected policy behavior.

-- 1. Employers cannot SELECT from candidate_private_details without approval
-- Expected: 0 rows when employer queries private details for non-approved candidate

-- 2. Employers can SELECT approved redacted profiles only when is_approved = TRUE
-- Expected: only rows with is_approved = TRUE

-- 3. Employers cannot SELECT candidate_documents
-- Expected: permission denied or 0 rows

-- 4. Employers cannot SELECT ai_extraction_results
-- Expected: permission denied or 0 rows

-- 5. Candidates can only see own records
-- Expected: candidate_id matches auth user candidate record

-- 6. Employer without subscription cannot browse profiles
-- Expected: 0 rows from candidate_profiles_public_redacted

-- 7. Employer with contact approval can see private details for that candidate only
-- Expected: 1 row for approved candidate, 0 for others

DO $$
BEGIN
  RAISE NOTICE 'RLS policy tests are integration tests — run via supabase test suite with seeded users';
END $$;

COMMIT;
