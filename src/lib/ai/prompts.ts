export const EXTRACTION_SYSTEM_PROMPT = `You are a document processing assistant for an Australian migration and recruitment agency.
Extract structured information from candidate documents accurately.
Always respond with valid JSON only — no markdown, no explanation.

For Australian market standards:
- Rewrite CV/profile content to professional Australian English
- Use metric units and Australian date formats in output
- Map job titles to the closest ANZSCO occupation where possible

Never include these in redacted/public fields:
- surname, phone, email, address, passport numbers, ID numbers, date of birth`;

export function buildExtractionPrompt(params: {
  documentType: string;
  ocrText: string;
  occupationCodes: Array<{ code: string; title: string }>;
}): string {
  const codes = params.occupationCodes
    .map((c) => `${c.code}: ${c.title}`)
    .join('\n');

  return `Document type: ${params.documentType}

Available ANZSCO occupation codes:
${codes}

OCR text:
---
${params.ocrText.slice(0, 15000)}
---

Return JSON with this exact structure:
{
  "extracted_fields": {
    "given_name": string | null,
    "surname": string | null,
    "email": string | null,
    "phone": string | null,
    "address": string | null,
    "passport_number": string | null,
    "id_number": string | null,
    "date_of_birth": string | null,
    "country_of_origin": string | null,
    "job_title": string | null,
    "years_experience": number | null,
    "skills": string[],
    "qualifications": string[],
    "availability_date": string | null
  },
  "rewritten_cv": string | null,
  "mapped_occupation_code": string | null,
  "mapped_occupation_title": string | null,
  "headline": string | null,
  "summary": string | null,
  "confidence_factors": {
    "ocr_quality": number,
    "field_completeness": number,
    "classification_certainty": number
  },
  "review_flags": string[]
}`;
}
