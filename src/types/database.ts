export type AppRole = 'candidate' | 'employer' | 'admin';
export type AdminRole = 'reviewer' | 'manager' | 'super_admin';
export type DocumentType = 'cv' | 'passport' | 'id' | 'qualification' | 'consent' | 'other';
export type DocumentStatus = 'pending' | 'processing' | 'review_required' | 'approved' | 'rejected';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type UnlockRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
export type AccessTier = 'candidate_only' | 'admin_only' | 'employer_redacted' | 'employer_full_contact';

export interface Profile {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  user_id: string;
  given_name: string | null;
  preferred_name: string | null;
  country_of_origin: string | null;
  current_location: string | null;
  occupation_code_id: string | null;
  case_stage_id: string | null;
  onboarding_completed: boolean;
  consent_given_at: string | null;
  consent_version: string | null;
  availability_date: string | null;
  years_experience: number | null;
  skills: string[];
  created_at: string;
  updated_at: string;
}

export interface CandidatePrivateDetails {
  id: string;
  candidate_id: string;
  surname: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  passport_number: string | null;
  passport_country: string | null;
  passport_expiry: string | null;
  id_document_number: string | null;
  date_of_birth: string | null;
}

export interface RedactedProfile {
  id: string;
  candidate_id: string;
  display_name: string;
  headline: string | null;
  summary: string | null;
  occupation_title: string | null;
  occupation_code_id: string | null;
  country_of_origin: string | null;
  years_experience: number | null;
  skills: string[];
  qualifications_summary: string | null;
  availability_date: string | null;
  visa_stage: string | null;
  is_approved: boolean;
  approved_at: string | null;
  updated_at: string;
}

export interface EmployerAccount {
  id: string;
  user_id: string;
  company_name: string;
  abn: string | null;
  industry: string | null;
  contact_given_name: string | null;
  website: string | null;
  is_verified: boolean;
}

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: DocumentType;
  status: DocumentStatus;
  access_tier: AccessTier;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

export interface ContactUnlockRequest {
  id: string;
  employer_id: string;
  candidate_id: string;
  status: UnlockRequestStatus;
  message: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  employer_id: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
}

export interface CaseStage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface OccupationCode {
  id: string;
  code: string;
  title: string;
  description: string | null;
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
  confidence_score: number | null;
  extracted_fields: Record<string, unknown> | null;
  is_admin_approved: boolean;
}
