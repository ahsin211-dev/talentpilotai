import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionPrompt } from './prompts';
import { computeConfidenceScore, type ConfidenceFactors } from './confidence';

const MODEL = 'claude-sonnet-4-20250514';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface ExtractionResult {
  extracted_fields: Record<string, unknown>;
  rewritten_cv: string | null;
  mapped_occupation_code: string | null;
  mapped_occupation_title: string | null;
  headline: string | null;
  summary: string | null;
  confidence_factors: ConfidenceFactors;
  confidence_score: number;
  review_flags: string[];
  raw_ai_output: Record<string, unknown>;
  model_version: string;
}

export async function extractWithClaude(params: {
  documentType: string;
  ocrText: string;
  occupationCodes: Array<{ code: string; title: string }>;
}): Promise<ExtractionResult> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildExtractionPrompt(params),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? rawText);
  } catch {
    parsed = { extracted_fields: {}, review_flags: ['json_parse_failed'] };
  }

  const factors = (parsed.confidence_factors ?? {
    ocr_quality: 50,
    field_completeness: 50,
    classification_certainty: 50,
  }) as ConfidenceFactors;

  const extractedFields = (parsed.extracted_fields ?? {}) as Record<string, unknown>;
  const confidenceScore = computeConfidenceScore(factors, extractedFields);

  return {
    extracted_fields: extractedFields,
    rewritten_cv: (parsed.rewritten_cv as string) ?? null,
    mapped_occupation_code: (parsed.mapped_occupation_code as string) ?? null,
    mapped_occupation_title: (parsed.mapped_occupation_title as string) ?? null,
    headline: (parsed.headline as string) ?? null,
    summary: (parsed.summary as string) ?? null,
    confidence_factors: factors,
    confidence_score: confidenceScore,
    review_flags: (parsed.review_flags as string[]) ?? [],
    raw_ai_output: parsed,
    model_version: MODEL,
  };
}

/** Development fallback when API key is not configured. */
export function mockExtraction(ocrText: string, documentType: string): ExtractionResult {
  const factors: ConfidenceFactors = {
    ocr_quality: ocrText.length > 100 ? 70 : 30,
    field_completeness: 40,
    classification_certainty: 50,
  };

  const extracted_fields: Record<string, unknown> = {
    given_name: 'Candidate',
    job_title: documentType === 'cv' ? 'Tradesperson' : null,
    skills: [],
    years_experience: null,
  };

  return {
    extracted_fields,
    rewritten_cv: ocrText ? `Professional summary (mock):\n${ocrText.slice(0, 500)}` : null,
    mapped_occupation_code: null,
    mapped_occupation_title: null,
    headline: 'Skilled tradesperson',
    summary: 'Profile pending full AI processing.',
    confidence_factors: factors,
    confidence_score: computeConfidenceScore(factors, extracted_fields),
    review_flags: ['mock_extraction'],
    raw_ai_output: { mock: true },
    model_version: 'mock-v1',
  };
}
