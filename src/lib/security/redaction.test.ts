import { describe, expect, it } from "vitest";

import {
  makeEmployerDisplayName,
  redactSensitiveText
} from "@/lib/security/redaction";

describe("redactSensitiveText", () => {
  it("removes common personal identifiers", () => {
    const input =
      "Maria Santos lives at 12 Market Street, Perth. Email maria@example.com or call +61 412 345 678. Passport number: P1234567.";

    const output = redactSensitiveText(input);

    expect(output).not.toContain("maria@example.com");
    expect(output).not.toContain("+61 412 345 678");
    expect(output).not.toContain("12 Market Street");
    expect(output).not.toContain("P1234567");
    expect(output).toContain("[redacted-email]");
    expect(output).toContain("[redacted-phone]");
    expect(output).toContain("[redacted-address]");
    expect(output).toContain("[redacted-id]");
  });
});

describe("makeEmployerDisplayName", () => {
  it("keeps only the surname initial for employer-facing profiles", () => {
    expect(makeEmployerDisplayName("Joseph", "Mendoza")).toBe("Joseph M.");
  });
});
