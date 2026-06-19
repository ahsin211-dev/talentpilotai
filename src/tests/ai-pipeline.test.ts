import { describe, it, expect } from 'vitest';
import { redactExtractedFields, scrubPiiFromText } from '@/lib/ai/redaction';
import { computeConfidenceScore, confidenceLabel } from '@/lib/ai/confidence';
import { mockExtraction } from '@/lib/ai/claude';

describe('PII redaction', () => {
  it('removes surname, email, phone from redacted output', () => {
    const result = redactExtractedFields(
      {
        given_name: 'John',
        surname: 'Smith',
        email: 'john@example.com',
        phone: '0412345678',
        job_title: 'Electrician',
        skills: ['wiring'],
      },
      'Johnny',
      'John'
    );

    expect(result.redacted_fields).not.toHaveProperty('surname');
    expect(result.redacted_fields).not.toHaveProperty('email');
    expect(result.redacted_fields).not.toHaveProperty('phone');
    expect(result.redacted_fields.job_title).toBe('Electrician');
    expect(result.display_name).toBe('Johnny');
  });

  it('scrubs email and phone from free text', () => {
    const text = 'Contact me at john@example.com or 0412 345 678';
    const scrubbed = scrubPiiFromText(text);
    expect(scrubbed).not.toContain('john@example.com');
    expect(scrubbed).toContain('[REDACTED]');
  });
});

describe('Confidence scoring', () => {
  it('returns high label for scores >= 80', () => {
    expect(confidenceLabel(85)).toBe('high');
    expect(confidenceLabel(60)).toBe('medium');
    expect(confidenceLabel(40)).toBe('low');
  });

  it('computes score from factors and field completeness', () => {
    const score = computeConfidenceScore(
      { ocr_quality: 90, field_completeness: 80, classification_certainty: 85 },
      { given_name: 'John', job_title: 'Plumber', skills: ['pipes'], years_experience: 5 }
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });
});

describe('Mock extraction', () => {
  it('returns valid extraction structure', () => {
    const result = mockExtraction('Sample CV text for electrician with 10 years experience', 'cv');
    expect(result.extracted_fields).toBeDefined();
    expect(result.confidence_score).toBeGreaterThan(0);
    expect(result.review_flags).toContain('mock_extraction');
  });
});

describe('E-signature verification', () => {
  it('rejects missing signature', async () => {
    const { verifyEsignatureWebhook } = await import('@/lib/integrations/esignature');
    expect(verifyEsignatureWebhook('{}', null)).toBe(false);
  });
});
