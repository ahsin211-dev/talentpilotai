interface SyncPayload {
  candidate_id: string;
  document_type?: string;
  confidence_score?: number;
  stage?: string;
}

/** Sync candidate data to external recruitment CRM via webhook/API. */
export async function syncToCrm(
  eventType: string,
  payload: SyncPayload
): Promise<void> {
  const crmUrl = process.env.CRM_SYNC_URL;
  const crmApiKey = process.env.CRM_API_KEY;

  if (!crmUrl) return;

  const { createServiceClient } = await import('@/lib/supabase/admin');
  const supabase = createServiceClient();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, case_stages(slug, name)')
    .eq('id', payload.candidate_id)
    .single();

  const { data: profile } = await supabase
    .from('candidate_profiles_public_redacted')
    .select('display_name, headline, occupation_title, skills, is_approved')
    .eq('candidate_id', payload.candidate_id)
    .maybeSingle();

  const response = await fetch(crmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(crmApiKey ? { Authorization: `Bearer ${crmApiKey}` } : {}),
    },
    body: JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      candidate: {
        id: payload.candidate_id,
        country: candidate?.country_of_origin,
        stage: (candidate?.case_stages as { slug?: string })?.slug,
        years_experience: candidate?.years_experience,
      },
      profile: profile
        ? {
            display_name: profile.display_name,
            headline: profile.headline,
            occupation: profile.occupation_title,
            skills: profile.skills,
            approved: profile.is_approved,
          }
        : null,
      metadata: {
        document_type: payload.document_type,
        confidence_score: payload.confidence_score,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`CRM sync failed: ${response.status}`);
  }
}
