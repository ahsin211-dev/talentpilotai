-- RLS intent tests for Supabase local test runners.
-- These assertions document the sensitive access rules that must remain true as policies evolve.
-- They are complementary to the Vitest migration regression tests in tests/rls-policy-regression.test.ts.

begin;

select plan(6);

select has_table('public', 'candidate_profiles_public_redacted', 'redacted employer profile table exists');
select has_table('public', 'candidate_private_details', 'private candidate details table exists');
select has_table('public', 'candidate_documents', 'candidate documents table exists');
select has_function('public', 'get_approved_candidate_contact', ARRAY['uuid'], 'approved contact release function exists');

select policies_are(
  'public',
  'ai_extraction_results',
  ARRAY['ai_results_admin_only'],
  'raw AI extraction results are admin-only'
);

select policies_are(
  'public',
  'candidate_documents',
  ARRAY['candidate_documents_candidate_or_admin'],
  'raw document access is limited to candidate owner or admin'
);

select * from finish();

rollback;
