/**
 * Unit tests for pure, security-relevant logic that needs no database:
 * PII redaction, occupation mapping, and file validation.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { redactText, buildDisplayName, assertNoPii } from "../../src/lib/ai/redact.ts";
import { matchOccupation } from "../../src/lib/ai/occupation.ts";
import { validateFileMeta, validateMagicBytes } from "../../src/lib/files/validate.ts";

describe("PII redaction", () => {
  test("removes email, phone, id and surname", () => {
    const out = redactText({
      text: "Contact John Smith at john.smith@example.com or +61 400 000 000, passport P1234567",
      firstName: "John",
      lastName: "Smith",
    });
    assert.ok(!out.includes("john.smith@example.com"));
    assert.ok(!out.includes("Smith"));
    assert.ok(out.includes("[redacted-email]"));
    assert.ok(out.includes("[redacted-phone]"));
  });

  test("display name never includes the surname", () => {
    assert.equal(buildDisplayName("John", "Smith"), "John S.");
    assert.equal(buildDisplayName("Maria", "Gonzalez"), "Maria G.");
    assert.equal(buildDisplayName(undefined, undefined), "Candidate");
  });

  test("assertNoPii throws when an email leaks", () => {
    assert.throws(() => assertNoPii({ summary: "reach me at a@b.com" }));
    assert.doesNotThrow(() => assertNoPii({ summary: "clean redacted profile" }));
  });
});

describe("Occupation mapping", () => {
  const codes = [
    { id: "1", code: "331212", title: "Carpenter", aliases: ["chippy", "joiner"] },
    { id: "2", code: "341111", title: "Electrician (General)", aliases: ["sparky", "electrician"] },
  ];
  test("exact title match -> confidence 1", () => {
    const m = matchOccupation("Carpenter", codes);
    assert.equal(m.code, "331212");
    assert.equal(m.confidence, 1);
  });
  test("alias match -> high confidence", () => {
    const m = matchOccupation("sparky", codes);
    assert.equal(m.code, "341111");
    assert.ok(m.confidence >= 0.9);
  });
  test("unknown -> no match", () => {
    assert.equal(matchOccupation("astronaut", codes).codeId, null);
  });
});

describe("File validation", () => {
  test("rejects oversize and unsupported types", () => {
    assert.equal(validateFileMeta({ mimeType: "application/pdf", sizeBytes: 26 * 1024 * 1024 }).ok, false);
    assert.equal(validateFileMeta({ mimeType: "application/x-msdownload", sizeBytes: 10 }).ok, false);
    assert.equal(validateFileMeta({ mimeType: "application/pdf", sizeBytes: 1024 }).ok, true);
  });
  test("magic-byte check catches content/type mismatch", () => {
    const pdfHead = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    assert.equal(validateMagicBytes("application/pdf", pdfHead).ok, true);
    const fakeHead = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    assert.equal(validateMagicBytes("application/pdf", fakeHead).ok, false);
  });
});
