/**
 * Anthropic Claude integration for structured extraction, AU-market rewrite,
 * and occupation classification. Falls back to deterministic heuristics when no
 * API key is configured so the pipeline runs end-to-end without external calls.
 *
 * IMPORTANT: the output of these functions is RAW AI output. It is persisted to
 * `ai_extraction_results.raw_output` and is NEVER shown to employers. Only the
 * admin-approved, redacted output ever reaches the employer-facing surface.
 */
import "server-only";
import { serverEnv, isConfigured } from "@/lib/env";
import { buildDisplayName, redactText } from "@/lib/ai/redact";

export interface ExtractedFields {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  occupationTitle?: string;
  skills: string[];
  yearsExperience?: number;
  highestQualification?: string;
  country?: string;
  summary?: string;
}

export interface AiExtraction {
  raw: ExtractedFields;
  redacted: {
    displayName: string;
    headline: string;
    summary: string;
    occupationTitle?: string;
    skills: string[];
    yearsExperience?: number;
    highestQualification?: string;
    countryOfOrigin?: string;
  };
  confidence: number;
  model: string;
  provider: "anthropic" | "stub";
}

export function isClaudeConfigured(): boolean {
  return isConfigured(serverEnv.anthropic.apiKey);
}

const SYSTEM_PROMPT = `You are an expert recruitment data extractor for an Australian
migration agency. Extract structured candidate fields from the OCR text. Then
produce a professional, Australian-market CV summary. Return STRICT JSON with
keys: firstName, lastName, email, phone, occupationTitle, skills (array),
yearsExperience (number), highestQualification, country, summary.`;

export async function extractFromText(ocrText: string): Promise<AiExtraction> {
  const raw = isClaudeConfigured()
    ? await extractWithClaude(ocrText)
    : extractWithHeuristics(ocrText);

  const redactedSummary = redactText({
    text: raw.summary ?? "",
    firstName: raw.firstName,
    lastName: raw.lastName,
  });

  return {
    raw,
    redacted: {
      displayName: buildDisplayName(raw.firstName, raw.lastName),
      headline: raw.occupationTitle
        ? `${raw.occupationTitle}${raw.yearsExperience ? ` · ${raw.yearsExperience}+ yrs` : ""}`
        : "Skilled tradesperson",
      summary: redactedSummary || "Experienced skilled tradesperson seeking AU opportunities.",
      occupationTitle: raw.occupationTitle,
      skills: raw.skills,
      yearsExperience: raw.yearsExperience,
      highestQualification: raw.highestQualification,
      countryOfOrigin: raw.country,
    },
    confidence: computeConfidence(raw),
    model: isClaudeConfigured() ? serverEnv.anthropic.model : "stub-heuristic",
    provider: isClaudeConfigured() ? "anthropic" : "stub",
  };
}

async function extractWithClaude(ocrText: string): Promise<ExtractedFields> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: serverEnv.anthropic.apiKey });
  const message = await anthropic.messages.create({
    model: serverEnv.anthropic.model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: ocrText.slice(0, 50_000) }],
  });
  const textBlock = message.content.find((c) => c.type === "text");
  const jsonText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const parsed = safeJson(jsonText);
  return normalizeFields(parsed);
}

/** Deterministic extraction used when no API key is present. */
function extractWithHeuristics(ocrText: string): ExtractedFields {
  const email = ocrText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/u)?.[0];
  const phone = ocrText.match(/\+?\d[\d\s().-]{6,}\d/u)?.[0];
  const years = Number(ocrText.match(/(\d{1,2})\s*\+?\s*years?/iu)?.[1] ?? "");
  const occupation =
    ocrText.match(
      /\b(carpenter|electrician|plumber|chef|bricklayer|welder|fabricator|tiler|plasterer|mechanic|baker|cabinetmaker|glazier)\b/iu,
    )?.[0] ?? undefined;
  const nameLine = ocrText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[A-Z][a-z]+\s+[A-Z][a-z]+$/u.test(l));
  const [firstName, lastName] = nameLine ? nameLine.split(/\s+/u) : [undefined, undefined];

  return {
    firstName,
    lastName,
    email,
    phone,
    occupationTitle: occupation ? capitalize(occupation) : undefined,
    skills: deriveSkills(ocrText),
    yearsExperience: Number.isFinite(years) && years > 0 ? years : undefined,
    highestQualification: ocrText.match(/\b(certificate\s+(?:i{1,3}|iv)|diploma|trade certificate)\b/iu)?.[0],
    country: ocrText.match(/\b(Philippines|India|Nepal|Vietnam|Indonesia|Fiji|Kenya)\b/u)?.[0],
    summary: occupation
      ? `${capitalize(occupation)} with ${Number.isFinite(years) && years > 0 ? years : "several"} years of hands-on experience, seeking sponsored work in Australia.`
      : "Skilled tradesperson seeking sponsored work in Australia.",
  };
}

function deriveSkills(text: string): string[] {
  const candidates = [
    "framing", "formwork", "welding", "wiring", "plumbing", "tiling",
    "roofing", "concreting", "fabrication", "carpentry", "maintenance",
  ];
  return candidates.filter((s) => new RegExp(`\\b${s}\\b`, "iu").test(text)).slice(0, 8);
}

function computeConfidence(raw: ExtractedFields): number {
  let score = 0;
  const checks: Array<boolean> = [
    !!raw.firstName,
    !!raw.occupationTitle,
    raw.skills.length > 0,
    raw.yearsExperience !== undefined,
    !!raw.highestQualification,
  ];
  for (const c of checks) if (c) score += 0.2;
  return Number(score.toFixed(2));
}

function normalizeFields(parsed: Record<string, unknown>): ExtractedFields {
  return {
    firstName: str(parsed.firstName),
    lastName: str(parsed.lastName),
    email: str(parsed.email),
    phone: str(parsed.phone),
    occupationTitle: str(parsed.occupationTitle),
    skills: Array.isArray(parsed.skills) ? parsed.skills.map(String).slice(0, 50) : [],
    yearsExperience: num(parsed.yearsExperience),
    highestQualification: str(parsed.highestQualification),
    country: str(parsed.country),
    summary: str(parsed.summary),
  };
}

function safeJson(text: string): Record<string, unknown> {
  try {
    const match = text.match(/\{[\s\S]*\}/u);
    return match ? JSON.parse(match[0]) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
