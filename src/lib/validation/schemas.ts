import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['candidate', 'employer']),
  companyName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const candidateIntakeSchema = z.object({
  givenName: z.string().min(1, 'Given name is required'),
  preferredName: z.string().optional(),
  surname: z.string().min(1, 'Surname is required'),
  phone: z.string().min(6, 'Valid phone required'),
  email: z.string().email(),
  countryOfOrigin: z.string().min(2),
  currentLocation: z.string().optional(),
  yearsExperience: z.coerce.number().int().min(0).max(50).optional(),
  skills: z.array(z.string()).default([]),
  availabilityDate: z.string().optional(),
  consentGiven: z.literal(true, { message: 'Consent is required' }),
  consentVersion: z.string().default('v1.0'),
});

export const documentUploadSchema = z.object({
  documentType: z.enum(['cv', 'passport', 'id', 'qualification', 'consent', 'other']),
  filename: z.string().min(1),
  mimeType: z.string().refine(
    (t) => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(t),
    'Only PDF and image files are allowed'
  ),
  fileSizeBytes: z.number().max(10 * 1024 * 1024, 'File must be under 10MB'),
});

export const unlockRequestSchema = z.object({
  candidateId: z.string().uuid(),
  message: z.string().max(1000).optional(),
});

export const contactApprovalSchema = z.object({
  unlockRequestId: z.string().uuid(),
  approved: z.boolean(),
});

export const profileApprovalSchema = z.object({
  profileId: z.string().uuid(),
  approved: z.boolean(),
  rejectionReason: z.string().optional(),
  editedFields: z.record(z.string(), z.unknown()).optional(),
});

export const employerSearchSchema = z.object({
  occupation: z.string().optional(),
  skills: z.array(z.string()).optional(),
  country: z.string().optional(),
  minExperience: z.coerce.number().optional(),
  visaStage: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
