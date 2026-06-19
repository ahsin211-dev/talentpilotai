import { createServiceClient } from '@/lib/supabase/admin';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

interface NotificationPayload {
  candidate_id: string;
  document_type?: string;
  confidence_score?: number;
  employer_id?: string;
}

const MESSAGE_TEMPLATES: Record<string, (p: NotificationPayload) => string> = {
  'document.processed':
    () => 'Your document has been processed and is now under review. We will notify you once approved.',
  'profile.approved':
    () => 'Great news! Your redacted profile has been approved and is now visible to employers.',
  'contact.approved':
    () => 'You approved an employer contact request. They can now reach you directly.',
  'contact.unlock_requested':
    () => 'An employer has requested to contact you. Please log in to approve or decline.',
};

/** Send WhatsApp Business API notification to candidate. */
export async function sendWhatsAppNotification(
  eventType: string,
  payload: NotificationPayload
): Promise<void> {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return;

  const supabase = createServiceClient();

  const { data: privateDetails } = await supabase
    .from('candidate_private_details')
    .select('phone')
    .eq('candidate_id', payload.candidate_id)
    .single();

  if (!privateDetails?.phone) return;

  const template = MESSAGE_TEMPLATES[eventType];
  if (!template) return;

  const message = template(payload);
  const phone = privateDetails.phone.replace(/\D/g, '');

  const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${body}`);
  }
}
