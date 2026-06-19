import { z } from "zod";

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const maxDocumentSizeBytes = 15 * 1024 * 1024;

export const candidateIntakeSchema = z.object({
  givenName: z.string().min(1).max(80),
  preferredName: z.string().max(80).optional(),
  surname: z.string().min(1).max(80),
  email: z.string().email().max(120),
  phone: z.string().min(5).max(30),
  countryOfOrigin: z.string().min(2).max(80),
  currentOccupation: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  consentDataProcessing: z.literal(true),
  consentMarketing: z.boolean().default(false),
});

export const candidateUploadRequestSchema = z.object({
  documentType: z.enum([
    "cv",
    "passport",
    "id_document",
    "qualification",
    "certificate",
    "other",
  ]),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.enum(allowedMimeTypes),
  fileSizeBytes: z.number().int().positive().max(maxDocumentSizeBytes),
  checksumSha256: z.string().length(64).regex(/^[a-f0-9]+$/i),
});

export const favouriteSchema = z.object({
  candidateId: z.string().uuid(),
});

export const unlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  message: z.string().max(1000).optional(),
});

export const contactApprovalSchema = z.object({
  employerId: z.string().uuid(),
  unlockRequestId: z.string().uuid().optional(),
  status: z.enum(["approved", "rejected"]),
});
