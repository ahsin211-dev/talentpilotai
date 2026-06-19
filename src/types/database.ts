export type UserRole = "candidate" | "employer" | "admin";

export type DocumentType =
  | "cv"
  | "passport"
  | "id"
  | "qualification"
  | "consent"
  | "other";

export type DocumentStatus =
  | "pending"
  | "processing"
  | "review_required"
  | "approved"
  | "rejected";

export type ProfileStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";

export type UnlockRequestStatus =
  | "pending"
  | "candidate_pending"
  | "approved"
  | "rejected"
  | "expired";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "retrying";

export type AccessTier =
  | "candidate_only"
  | "admin_only"
  | "employer_redacted"
  | "employer_full";

export interface UserProfile {
  id: string;
  role: UserRole;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  user_id: string;
  case_stage_id: string | null;
  onboarding_completed: boolean;
  consent_given_at: string | null;
  consent_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface CandidatePrivateDetails {
  id: string;
  candidate_id: string;
  first_name: string;
  surname: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  id_number: string | null;
  id_type: string | null;
}

export interface CandidateProfilePublic {
  id: string;
  candidate_id: string;
  display_first_name: string;
  professional_summary: string | null;
  rewritten_cv: string | null;
  occupation_code_id: string | null;
  occupation_title: string | null;
  skills: string[];
  qualifications: string[];
  years_experience: number | null;
  country_of_origin: string | null;
  availability_date: string | null;
  visa_stage: string | null;
  status: ProfileStatus;
  approved_at: string | null;
  approved_by: string | null;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: DocumentType;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  s3_bucket: string;
  s3_key: string;
  access_tier: AccessTier;
  status: DocumentStatus;
  uploaded_at: string;
}

export interface EmployerAccount {
  id: string;
  user_id: string;
  company_name: string;
  abn: string | null;
  industry: string | null;
  contact_first_name: string;
  contact_surname: string;
  contact_email: string;
  contact_phone: string | null;
  is_verified: boolean;
}

export interface EmployerCandidateProfile {
  id: string;
  candidate_id: string;
  display_first_name: string;
  professional_summary: string | null;
  rewritten_cv: string | null;
  occupation_title: string | null;
  skills: string[];
  qualifications: string[];
  years_experience: number | null;
  country_of_origin: string | null;
  availability_date: string | null;
  visa_stage: string | null;
  occupation_code: string | null;
}

export interface ContactUnlockRequest {
  id: string;
  employer_id: string;
  candidate_id: string;
  message: string | null;
  status: UnlockRequestStatus;
  requested_at: string;
  resolved_at: string | null;
}

export interface Subscription {
  id: string;
  employer_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
}

export interface CaseStage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface OccupationCode {
  id: string;
  code: string;
  title: string;
  description: string | null;
  skill_level: number | null;
}

export interface DocumentProcessingJob {
  id: string;
  document_id: string;
  status: JobStatus;
  job_type: string;
  attempt_count: number;
  error_message: string | null;
  created_at: string;
}

export interface AiExtractionResult {
  id: string;
  document_id: string;
  raw_ai_output: Record<string, unknown> | null;
  extracted_fields: Record<string, unknown> | null;
  redacted_fields: Record<string, unknown> | null;
  confidence_score: number | null;
  is_admin_approved: boolean;
  admin_edited_fields: Record<string, unknown> | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
