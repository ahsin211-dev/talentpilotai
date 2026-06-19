import { z } from "zod";

export const appRoles = ["candidate", "employer", "admin"] as const;
export type AppRole = (typeof appRoles)[number];

export const documentTypes = [
  "cv",
  "passport",
  "government_id",
  "qualification",
  "certificate",
  "employment_reference"
] as const;
export type DocumentType = (typeof documentTypes)[number];

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const candidateIntakeSchema = z.object({
  givenName: z.string().trim().min(2).max(80),
  surname: z.string().trim().min(2).max(80),
  email: z.string().email(),
  phone: z.string().trim().min(8).max(30),
  countryOfResidence: z.string().trim().min(2).max(80),
  nationality: z.string().trim().min(2).max(80),
  occupationTitle: z.string().trim().min(2).max(120),
  yearsExperience: z.number().int().min(0).max(50),
  visaInterest: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(40).max(5000),
  skills: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  consentAccepted: z.literal(true)
});
export type CandidateIntakeInput = z.infer<typeof candidateIntakeSchema>;

export const documentUploadRequestSchema = z.object({
  candidateId: z.string().uuid(),
  documentType: z.enum(documentTypes),
  fileName: z
    .string()
    .trim()
    .min(3)
    .max(180)
    .regex(/^[a-zA-Z0-9._-]+$/, "File names must be ASCII-safe."),
  contentType: z.enum(allowedDocumentMimeTypes),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES)
});
export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;

export const employerFavouriteSchema = z.object({
  candidateId: z.string().uuid()
});
export type EmployerFavouriteInput = z.infer<typeof employerFavouriteSchema>;

export const contactUnlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  rationale: z.string().trim().min(20).max(1000)
});
export type ContactUnlockRequestInput = z.infer<
  typeof contactUnlockRequestSchema
>;

export const adminPublishProfileSchema = z.object({
  candidateId: z.string().uuid(),
  occupationCode: z.string().trim().min(3).max(20),
  headline: z.string().trim().min(5).max(140),
  summaryRedacted: z.string().trim().min(30).max(5000),
  skills: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  confidenceScore: z.number().min(0).max(1)
});
export type AdminPublishProfileInput = z.infer<
  typeof adminPublishProfileSchema
>;

export const auditMetadataSchema = z.record(z.string(), z.unknown()).default({});

export type PortalMetric = {
  label: string;
  value: string;
  hint: string;
};
