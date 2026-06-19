export interface ConfidenceFactors {
  ocr_quality: number;
  field_completeness: number;
  classification_certainty: number;
}

const REQUIRED_FIELDS = ['given_name', 'job_title', 'skills', 'years_experience'];

/** Compute reviewer confidence score (0–100) from AI self-assessment and field coverage. */
export function computeConfidenceScore(
  factors: ConfidenceFactors,
  extractedFields: Record<string, unknown>
): number {
  const filledRequired = REQUIRED_FIELDS.filter((f) => {
    const val = extractedFields[f];
    return val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
  }).length;

  const completenessBonus = (filledRequired / REQUIRED_FIELDS.length) * 20;

  const raw =
    factors.ocr_quality * 0.35 +
    factors.field_completeness * 0.35 +
    factors.classification_certainty * 0.3 +
    completenessBonus;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function confidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}
