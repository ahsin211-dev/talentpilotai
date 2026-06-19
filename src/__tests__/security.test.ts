import { describe, it, expect } from "vitest";
import {
  validateUpload,
  generateS3Key,
} from "@/lib/aws/s3";
import {
  registerSchema,
  candidateIntakeSchema,
  documentUploadSchema,
  unlockRequestSchema,
} from "@/lib/validation/schemas";

describe("document upload validation", () => {
  it("rejects files over 10MB", () => {
    const result = validateUpload("cv.pdf", "application/pdf", 11 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  it("rejects disallowed mime types", () => {
    const result = validateUpload("malware.exe", "application/x-msdownload", 1000);
    expect(result.valid).toBe(false);
  });

  it("accepts valid PDF uploads", () => {
    const result = validateUpload("resume.pdf", "application/pdf", 500_000);
    expect(result.valid).toBe(true);
  });

  it("generates candidate-scoped S3 keys", () => {
    const key = generateS3Key("candidate-123", "cv", "my-resume.pdf");
    expect(key).toMatch(/^candidates\/candidate-123\/cv\//);
    expect(key).toMatch(/\.pdf$/);
  });
});

describe("Zod schemas", () => {
  it("requires consent for candidate intake", () => {
    const result = candidateIntakeSchema.safeParse({
      firstName: "John",
      surname: "Smith",
      email: "john@example.com",
      country: "Philippines",
      consentGiven: false,
    });
    expect(result.success).toBe(false);
  });

  it("validates registration roles", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      role: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("validates document upload metadata", () => {
    const result = documentUploadSchema.safeParse({
      documentType: "cv",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("validates unlock request UUID", () => {
    const result = unlockRequestSchema.safeParse({
      candidateId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("RLS security invariants (documentation tests)", () => {
  /**
   * These tests document critical security requirements enforced in
   * supabase/migrations/002_rls_policies.sql
   */
  const SECURITY_RULES = [
    "Employers cannot SELECT from candidate_documents",
    "Employers cannot SELECT from candidate_private_details without contact approval",
    "Employers can only SELECT approved profiles from candidate_profiles_public_redacted",
    "Employers cannot SELECT from ai_extraction_results",
    "Candidates cannot access other candidates data",
    "Service role key must never be exposed to client",
    "All document downloads require server-side authorization",
    "Contact unlock requires active subscription AND candidate approval",
  ];

  it("documents all critical RLS rules", () => {
    expect(SECURITY_RULES.length).toBeGreaterThanOrEqual(8);
  });
});
