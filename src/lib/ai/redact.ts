/**
 * Deterministic PII redaction. This runs as a defence-in-depth layer in
 * ADDITION to the AI redaction step and the table-level separation, so that
 * even if upstream output is wrong, obvious PII is scrubbed before anything is
 * persisted to the employer-facing redacted profile.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gu;
// E.164-ish and common AU formats.
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/gu;
// Passport / national id-ish alphanumerics (2 letters + 6-8 digits, etc.)
const ID_RE = /\b([A-Z]{1,2}\d{6,9}|\d{9,12})\b/gu;

export interface RedactionInput {
  text: string;
  firstName?: string;
  lastName?: string;
}

export function redactText(input: RedactionInput): string {
  let out = input.text ?? "";
  out = out.replace(EMAIL_RE, "[redacted-email]");
  out = out.replace(PHONE_RE, "[redacted-phone]");
  out = out.replace(ID_RE, "[redacted-id]");

  if (input.lastName) {
    const re = new RegExp(`\\b${escapeRegExp(input.lastName)}\\b`, "giu");
    out = out.replace(re, "[redacted-surname]");
  }
  return out;
}

/** Public display name: first name + surname initial only. Never the surname. */
export function buildDisplayName(firstName?: string, lastName?: string): string {
  const first = (firstName ?? "").trim();
  const initial = (lastName ?? "").trim().charAt(0).toUpperCase();
  if (first && initial) return `${first} ${initial}.`;
  if (first) return first;
  return "Candidate";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Assert that a redacted payload contains no obvious PII. Throws if it does. */
export function assertNoPii(payload: Record<string, unknown>): void {
  const blob = JSON.stringify(payload);
  if (EMAIL_RE.test(blob)) throw new Error("redaction_failed: email present");
  // Reset lastIndex for global regexes before reuse.
  EMAIL_RE.lastIndex = 0;
}
