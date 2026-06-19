/**
 * Occupation code mapping. Maps a free-text job title to a supplied standard
 * ANZSCO occupation code via exact/alias/substring matching with a confidence
 * score. The actual code list comes from the `occupation_codes` table so admins
 * can manage it without code changes.
 */
export interface OccupationCodeRow {
  id: string;
  code: string;
  title: string;
  aliases: string[];
}

export interface OccupationMatch {
  codeId: string | null;
  code: string | null;
  title: string | null;
  confidence: number;
}

export function matchOccupation(
  jobTitle: string | undefined,
  codes: OccupationCodeRow[],
): OccupationMatch {
  const none: OccupationMatch = { codeId: null, code: null, title: null, confidence: 0 };
  if (!jobTitle) return none;
  const q = jobTitle.trim().toLowerCase();
  if (!q) return none;

  // 1. Exact title match.
  for (const c of codes) {
    if (c.title.toLowerCase() === q) {
      return { codeId: c.id, code: c.code, title: c.title, confidence: 1 };
    }
  }
  // 2. Alias exact match.
  for (const c of codes) {
    if (c.aliases.some((a) => a.toLowerCase() === q)) {
      return { codeId: c.id, code: c.code, title: c.title, confidence: 0.9 };
    }
  }
  // 3. Substring / token overlap.
  let best: OccupationMatch = none;
  for (const c of codes) {
    const haystack = [c.title, ...c.aliases].join(" ").toLowerCase();
    if (haystack.includes(q) || q.includes(c.title.toLowerCase())) {
      const confidence = 0.7;
      if (confidence > best.confidence) {
        best = { codeId: c.id, code: c.code, title: c.title, confidence };
      }
    }
  }
  return best;
}
