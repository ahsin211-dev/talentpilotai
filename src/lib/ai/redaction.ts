/** PII fields that must never appear in employer-visible redacted output. */
const PII_FIELDS = new Set([
  'surname',
  'email',
  'phone',
  'address',
  'address_line1',
  'address_line2',
  'passport_number',
  'passport_country',
  'id_number',
  'id_document_number',
  'date_of_birth',
  'postal_code',
  'city',
  'state_region',
]);

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
  /\b[A-Z]{1,2}\d{6,9}\b/g, // passport-like
];

export interface RedactedOutput {
  redacted_fields: Record<string, unknown>;
  display_name: string;
  public_summary: string | null;
}

export function redactExtractedFields(
  fields: Record<string, unknown>,
  preferredName?: string | null,
  givenName?: string | null
): RedactedOutput {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (!PII_FIELDS.has(key) && value != null && value !== '') {
      redacted[key] = value;
    }
  }

  const displayName = preferredName || givenName || 'Candidate';

  let publicSummary: string | null = null;
  if (typeof fields.summary === 'string') {
    publicSummary = scrubPiiFromText(fields.summary);
  }

  return {
    redacted_fields: redacted,
    display_name: displayName,
    public_summary: publicSummary,
  };
}

/** Remove PII patterns from free text (CV rewrites, summaries). */
export function scrubPiiFromText(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}
