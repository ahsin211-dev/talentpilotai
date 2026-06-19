import { createServiceClient } from '@/lib/supabase/admin';

type EntityType = 'candidate' | 'document';

const STAGE_SLUGS = [
  'intake',
  'documents_pending',
  'ai_processing',
  'admin_review',
  'profile_approved',
  'employer_matching',
  'contact_unlocked',
  'placed',
  'withdrawn',
  'rejected',
] as const;

export type CaseStageSlug = (typeof STAGE_SLUGS)[number];

/** Advance a candidate's case to the specified stage. */
export async function advanceCaseStage(
  entityId: string,
  stageSlug: CaseStageSlug,
  entityType: EntityType = 'candidate'
): Promise<void> {
  const supabase = createServiceClient();

  const { data: stage } = await supabase
    .from('case_stages')
    .select('id')
    .eq('slug', stageSlug)
    .single();

  if (!stage) return;

  let candidateId = entityId;

  if (entityType === 'document') {
    const { data: doc } = await supabase
      .from('candidate_documents')
      .select('candidate_id')
      .eq('id', entityId)
      .single();
    if (!doc) return;
    candidateId = doc.candidate_id;
  }

  await supabase
    .from('candidates')
    .update({ case_stage_id: stage.id })
    .eq('id', candidateId);
}

export async function getCaseStages() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('case_stages')
    .select('*')
    .order('sort_order');
  return data ?? [];
}

export async function setCandidateCaseStage(
  candidateId: string,
  stageSlug: CaseStageSlug
): Promise<void> {
  await advanceCaseStage(candidateId, stageSlug, 'candidate');
}

export { STAGE_SLUGS };
