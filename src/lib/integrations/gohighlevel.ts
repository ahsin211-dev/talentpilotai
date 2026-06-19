const GHL_API_URL = 'https://rest.gohighlevel.com/v1';

interface SyncPayload {
  candidate_id: string;
  document_type?: string;
  confidence_score?: number;
  stage?: string;
}

/** Sync candidate events to GoHighLevel CRM. */
export async function syncToGoHighLevel(
  eventType: string,
  payload: SyncPayload
): Promise<void> {
  const apiKey = process.env.GOHIGHLEVEL_API_KEY;
  const locationId = process.env.GOHIGHLEVEL_LOCATION_ID;

  if (!apiKey || !locationId) return;

  const { createServiceClient } = await import('@/lib/supabase/admin');
  const supabase = createServiceClient();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('given_name, preferred_name, country_of_origin, case_stages(name)')
    .eq('id', payload.candidate_id)
    .single();

  const { data: privateDetails } = await supabase
    .from('candidate_private_details')
    .select('email, phone, surname')
    .eq('candidate_id', payload.candidate_id)
    .single();

  if (!privateDetails?.email) return;

  const response = await fetch(`${GHL_API_URL}/contacts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId,
      email: privateDetails.email,
      phone: privateDetails.phone,
      firstName: candidate?.preferred_name || candidate?.given_name,
      lastName: privateDetails.surname,
      source: 'TalentPilot AI',
      tags: [`event:${eventType}`, `stage:${(candidate?.case_stages as { name?: string })?.name ?? 'unknown'}`],
      customFields: [
        { key: 'country_of_origin', value: candidate?.country_of_origin },
        { key: 'last_event', value: eventType },
        { key: 'confidence_score', value: String(payload.confidence_score ?? '') },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GoHighLevel API error: ${response.status} ${body}`);
  }
}
