import { z } from "zod";

export const allowedDocumentTypes = ["cv", "passport", "id", "qualification", "certificate", "other"] as const;
export const caseStages = [
  "intake",
  "documents_pending",
  "ai_review",
  "admin_review",
  "employer_visible",
  "contact_requested",
  "contact_approved",
  "placed",
  "visa_case_open",
  "visa_lodged",
  "visa_granted",
  "closed"
] as const;

export const allowedUploadMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

export const maxUploadBytes = 15 * 1024 * 1024;

export const candidateIntakeSchema = z.object({
  givenName: z.string().trim().min(1).max(100),
  surname: z.string().trim().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().trim().min(4).max(40).optional(),
  whatsapp: z.string().trim().min(4).max(40).optional(),
  countryOfResidence: z.string().trim().min(2).max(100),
  primaryTrade: z.string().trim().min(2).max(120),
  yearsExperience: z.number().min(0).max(60).optional(),
  availabilityDate: z.string().date().optional(),
  consentAccepted: z.literal(true)
});

export const documentUploadRequestSchema = z.object({
  candidateId: z.string().uuid(),
  documentType: z.enum(allowedDocumentTypes),
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(allowedUploadMimeTypes),
  byteSize: z.number().int().positive().max(maxUploadBytes),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
});

export const favouriteRequestSchema = z.object({
  candidateId: z.string().uuid()
});

export const unlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  messageToCandidate: z.string().trim().max(1000).optional()
});

export const adminPublishProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  countryOfResidence: z.string().trim().min(2).max(100),
  primaryTrade: z.string().trim().min(2).max(120),
  occupationCodeId: z.string().uuid().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(30),
  qualifications: z.array(z.string().trim().min(1).max(120)).max(30),
  yearsExperience: z.number().min(0).max(60).optional(),
  availabilityDate: z.string().date().optional(),
  visaStage: z.enum(caseStages),
  professionalSummary: z.string().trim().min(50).max(2500)
});
