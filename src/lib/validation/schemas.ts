/**
 * Zod schemas for all API / server-action inputs. Validation happens at the
 * trust boundary before any privileged operation runs.
 */
import { z } from "zod";

export const documentTypeEnum = z.enum([
  "cv",
  "passport",
  "national_id",
  "qualification",
  "certificate",
  "reference",
  "other",
]);

export const candidateIntakeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(6).max(30),
  country: z.string().min(2).max(100),
  nationality: z.string().min(2).max(100).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Expected YYYY-MM-DD")
    .optional(),
  occupationTitle: z.string().min(2).max(150),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Consent is required to proceed" }),
  }),
});
export type CandidateIntakeInput = z.infer<typeof candidateIntakeSchema>;

export const uploadRequestSchema = z.object({
  documentType: documentTypeEnum,
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSizeBytes: z.coerce.number().int().positive().max(25 * 1024 * 1024), // 25 MB
});
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;

export const employerSignupSchema = z.object({
  companyName: z.string().min(2).max(200),
  abn: z.string().regex(/^\d{11}$/u, "ABN must be 11 digits").optional(),
  contactName: z.string().min(2).max(150),
  contactEmail: z.string().email().max(255),
});

export const candidateSearchSchema = z.object({
  occupationCode: z.string().max(20).optional(),
  skills: z.array(z.string().max(60)).max(20).optional(),
  country: z.string().max(100).optional(),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  visaStage: z.string().max(100).optional(),
  availability: z.string().max(100).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type CandidateSearchInput = z.infer<typeof candidateSearchSchema>;

export const unlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  candidateProfileId: z.string().uuid().optional(),
  message: z.string().max(2000).optional(),
});

export const unlockResponseSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  consentText: z.string().max(4000).optional(),
  consentVersion: z.string().max(20).optional(),
});

export const adminReviewSchema = z.object({
  aiResultId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "edit"]),
  approvedOutput: z
    .object({
      displayName: z.string().max(150).optional(),
      headline: z.string().max(200).optional(),
      summary: z.string().max(5000).optional(),
      occupationCodeId: z.string().uuid().optional(),
      occupationTitle: z.string().max(150).optional(),
      skills: z.array(z.string().max(60)).max(50).optional(),
      yearsExperience: z.number().int().min(0).max(60).optional(),
      countryOfOrigin: z.string().max(100).optional(),
      availability: z.string().max(100).optional(),
      visaStage: z.string().max(100).optional(),
      highestQualification: z.string().max(200).optional(),
    })
    .optional(),
  reviewerNotes: z.string().max(4000).optional(),
});

export const caseStageSchema = z.object({
  candidateId: z.string().uuid(),
  stage: z.enum([
    "intake",
    "document_review",
    "ai_processing",
    "admin_review",
    "profile_published",
    "employer_matching",
    "contact_approved",
    "placed",
    "rejected",
    "withdrawn",
  ]),
  notes: z.string().max(2000).optional(),
});
