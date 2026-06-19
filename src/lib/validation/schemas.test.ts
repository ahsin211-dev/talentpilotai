import { describe, expect, it } from "vitest";
import {
  candidateIntakeSchema,
  candidateUploadRequestSchema,
  unlockRequestSchema,
} from "@/lib/validation/schemas";

describe("candidateIntakeSchema", () => {
  it("requires explicit data processing consent", () => {
    const result = candidateIntakeSchema.safeParse({
      givenName: "Alex",
      surname: "Doe",
      email: "alex@example.com",
      phone: "+61400111222",
      countryOfOrigin: "Philippines",
      consentDataProcessing: false,
      consentMarketing: false,
    });

    expect(result.success).toBe(false);
  });
});

describe("candidateUploadRequestSchema", () => {
  it("blocks non-whitelisted file types", () => {
    const result = candidateUploadRequestSchema.safeParse({
      documentType: "cv",
      originalFilename: "resume.exe",
      mimeType: "application/x-msdownload",
      fileSizeBytes: 1024,
      checksumSha256: "a".repeat(64),
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid secure upload metadata", () => {
    const result = candidateUploadRequestSchema.safeParse({
      documentType: "cv",
      originalFilename: "resume.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      checksumSha256: "a".repeat(64),
    });

    expect(result.success).toBe(true);
  });
});

describe("unlockRequestSchema", () => {
  it("requires a candidate UUID", () => {
    const result = unlockRequestSchema.safeParse({
      candidateId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });
});
