import { createServiceClient } from '@/lib/supabase/admin';
import { sendWhatsAppNotification } from './whatsapp';
import { syncToGoHighLevel } from './gohighlevel';
import { syncToCrm } from './crm';

export type IntegrationEvent =
  | 'document.processed'
  | 'document.processing_failed'
  | 'profile.approved'
  | 'contact.approved'
  | 'contact.unlock_requested'
  | 'case.stage_changed'
  | 'consent.signed';

interface EventPayload {
  candidate_id: string;
  document_id?: string;
  job_id?: string;
  confidence_score?: number;
  document_type?: string;
  error?: string;
  stage?: string;
  employer_id?: string;
  [key: string]: unknown;
}

/**
 * Dispatch events to configured integrations with retry tracking.
 * Failed deliveries are stored in webhook_deliveries for admin retry.
 */
export async function dispatchEvent(
  eventType: IntegrationEvent,
  payload: EventPayload
): Promise<void> {
  const supabase = createServiceClient();

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('is_active', true)
    .contains('event_types', [eventType]);

  const deliveryPayload = { event: eventType, timestamp: new Date().toISOString(), data: payload };

  // Built-in integrations (run regardless of webhook config)
  const integrationTasks: Promise<void>[] = [];

  if (['document.processed', 'profile.approved', 'contact.approved'].includes(eventType)) {
    integrationTasks.push(
      sendWhatsAppNotification(eventType, payload).catch((e) =>
        console.error('WhatsApp notification failed:', e)
      )
    );
  }

  if (['document.processed', 'profile.approved', 'case.stage_changed'].includes(eventType)) {
    integrationTasks.push(
      syncToGoHighLevel(eventType, payload).catch((e) =>
        console.error('GoHighLevel sync failed:', e)
      )
    );
    integrationTasks.push(
      syncToCrm(eventType, payload).catch((e) =>
        console.error('CRM sync failed:', e)
      )
    );
  }

  await Promise.allSettled(integrationTasks);

  // Configured webhook endpoints
  for (const webhook of webhooks ?? []) {
    const { data: delivery } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: eventType,
        payload: deliveryPayload,
        status: 'pending',
      })
      .select('id')
      .single();

    if (!webhook.endpoint_url) continue;

    try {
      const response = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.secret_encrypted
            ? { 'X-Webhook-Secret': webhook.secret_encrypted }
            : {}),
        },
        body: JSON.stringify(deliveryPayload),
      });

      await supabase
        .from('webhook_deliveries')
        .update({
          status: response.ok ? 'delivered' : 'failed',
          response_status: response.status,
          response_body: await response.text().catch(() => null),
          delivered_at: response.ok ? new Date().toISOString() : null,
          attempt_count: 1,
          error_message: response.ok ? null : `HTTP ${response.status}`,
          next_retry_at: response.ok
            ? null
            : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', delivery?.id);
    } catch (err) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          attempt_count: 1,
          error_message: err instanceof Error ? err.message : 'Delivery failed',
          next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .eq('id', delivery?.id);
    }
  }
}

/** Retry failed webhook deliveries (called by admin or cron). */
export async function retryFailedDeliveries(limit = 10): Promise<number> {
  const supabase = createServiceClient();

  const { data: deliveries } = await supabase
    .from('webhook_deliveries')
    .select('*, webhooks(endpoint_url, secret_encrypted)')
    .in('status', ['failed', 'retrying'])
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempt_count', 5)
    .limit(limit);

  let retried = 0;

  for (const delivery of deliveries ?? []) {
    const webhook = delivery.webhooks as { endpoint_url?: string; secret_encrypted?: string } | null;
    if (!webhook?.endpoint_url) continue;

    try {
      const response = await fetch(webhook.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.secret_encrypted
            ? { 'X-Webhook-Secret': webhook.secret_encrypted }
            : {}),
        },
        body: JSON.stringify(delivery.payload),
      });

      await supabase
        .from('webhook_deliveries')
        .update({
          status: response.ok ? 'delivered' : 'retrying',
          attempt_count: delivery.attempt_count + 1,
          response_status: response.status,
          delivered_at: response.ok ? new Date().toISOString() : null,
          next_retry_at: response.ok
            ? null
            : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .eq('id', delivery.id);

      retried++;
    } catch {
      await supabase
        .from('webhook_deliveries')
        .update({
          attempt_count: delivery.attempt_count + 1,
          next_retry_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        })
        .eq('id', delivery.id);
    }
  }

  return retried;
}
