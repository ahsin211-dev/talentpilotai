const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]"],
  [
    /(?:(?:\+|00)61|0)\s?(?:4\d{2}|\d{1,2})\s?\d{3}\s?\d{3,4}/g,
    "[redacted-phone]"
  ],
  [/\b(?:passport|id|license)\s*(?:number|no\.?)?\s*[:#-]?\s*[A-Z0-9-]{5,}\b/gi, "[redacted-id]"],
  [/\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|road|rd|avenue|ave|drive|dr|close|cl|lane|ln|court|ct)\b/gi, "[redacted-address]"]
];

export function redactSensitiveText(input: string) {
  return REDACTION_PATTERNS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    input
  );
}

export function makeEmployerDisplayName(givenName: string, surname: string) {
  return `${givenName.trim()} ${surname.trim().charAt(0).toUpperCase()}.`;
}
