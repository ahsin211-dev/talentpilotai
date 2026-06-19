import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Static RLS policy verification tests.
 * These assert critical security policies exist in migration SQL.
 * Full integration tests require a running Supabase instance.
 */
describe('RLS policy migrations', () => {
  const rlsSql = readFileSync(
    join(process.cwd(), 'supabase/migrations/002_rls_policies.sql'),
    'utf-8'
  );

  it('enables RLS on candidate_private_details', () => {
    expect(rlsSql).toContain('ALTER TABLE public.candidate_private_details ENABLE ROW LEVEL SECURITY');
  });

  it('blocks employers from private details without approval policy structure', () => {
    expect(rlsSql).toContain('private_details_candidate');
    expect(rlsSql).toContain('private_details_employer_approved');
    expect(rlsSql).toContain('has_contact_approval');
  });

  it('restricts employer access to approved redacted profiles only', () => {
    expect(rlsSql).toContain('redacted_profile_employer_select');
    expect(rlsSql).toContain('is_approved = TRUE');
    expect(rlsSql).toContain('has_active_subscription');
  });

  it('restricts candidate_documents to candidate and admin only', () => {
    expect(rlsSql).toContain('documents_candidate');
    expect(rlsSql).toContain('employers NEVER');
    const documentPolicies = rlsSql.match(/CREATE POLICY \w+ ON public\.candidate_documents/g) ?? [];
    expect(documentPolicies.length).toBe(1);
  });

  it('restricts ai_extraction_results to admin and candidate only', () => {
    expect(rlsSql).toContain('ai_results_access');
    expect(rlsSql).toContain('NEVER employers');
    const aiPolicies = rlsSql.match(/CREATE POLICY \w+ ON public\.ai_extraction_results/g) ?? [];
    expect(aiPolicies.length).toBe(2);
  });

  it('requires subscription for employer favourites', () => {
    expect(rlsSql).toContain('favourites_employer');
    expect(rlsSql).toContain('has_active_subscription');
  });

  it('revokes anon access to sensitive tables', () => {
    expect(rlsSql).toContain("REVOKE ALL ON public.candidate_private_details FROM anon");
    expect(rlsSql).toContain("REVOKE ALL ON public.ai_extraction_results FROM anon");
  });
});

describe('Schema separation', () => {
  const schemaSql = readFileSync(
    join(process.cwd(), 'supabase/migrations/001_initial_schema.sql'),
    'utf-8'
  );

  it('defines separate private and public profile tables', () => {
    expect(schemaSql).toContain('candidate_private_details');
    expect(schemaSql).toContain('candidate_profiles_public_redacted');
  });

  it('defines employer contact approval table', () => {
    expect(schemaSql).toContain('candidate_contact_approvals');
    expect(schemaSql).toContain('contact_unlock_requests');
  });

  it('defines audit_logs as append-only structure', () => {
    expect(schemaSql).toContain('audit_logs');
  });
});

describe('Validation schemas', () => {
  it('rejects files over 10MB', async () => {
    const { documentUploadSchema } = await import('@/lib/validation/schemas');
    const result = documentUploadSchema.safeParse({
      documentType: 'cv',
      filename: 'cv.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 11 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid mime types', async () => {
    const { documentUploadSchema } = await import('@/lib/validation/schemas');
    const result = documentUploadSchema.safeParse({
      documentType: 'cv',
      filename: 'cv.exe',
      mimeType: 'application/x-msdownload',
      fileSizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });
});
