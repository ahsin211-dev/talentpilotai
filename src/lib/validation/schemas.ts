import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["candidate", "employer"]),
});

export const candidateIntakeSchema = z.object({
  firstName: z.string().min(1, "First name required").max(100),
  surname: z.string().min(1, "Surname required").max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().min(1, "Country required"),
  dateOfBirth: z.string().optional(),
  consentGiven: z.literal(true, { message: "You must provide consent to continue" }),
  consentVersion: z.string().default("1.0"),
});

export const employerRegisterSchema = z.object({
  companyName: z.string().min(1, "Company name required"),
  abn: z.string().optional(),
  industry: z.string().optional(),
  contactFirstName: z.string().min(1),
  contactSurname: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
});

export const documentUploadSchema = z.object({
  documentType: z.enum([
    "cv",
    "passport",
    "id",
    "qualification",
    "consent",
    "other",
  ]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive().max(10 * 1024 * 1024),
});

export const unlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  message: z.string().max(1000).optional(),
});

export const profileApprovalSchema = z.object({
  profileId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  adminEditedFields: z.record(z.string(), z.unknown()).optional(),
  rejectionReason: z.string().optional(),
});

export const documentReviewSchema = z.object({
  documentId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().optional(),
});

export const candidateSearchSchema = z.object({
  occupation: z.string().optional(),
  skills: z.string().optional(),
  country: z.string().optional(),
  minExperience: z.coerce.number().optional(),
  visaStage: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CandidateIntakeInput = z.infer<typeof candidateIntakeSchema>;
export type EmployerRegisterInput = z.infer<typeof employerRegisterSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type UnlockRequestInput = z.infer<typeof unlockRequestSchema>;
export type ProfileApprovalInput = z.infer<typeof profileApprovalSchema>;
export type CandidateSearchInput = z.infer<typeof candidateSearchSchema>;
