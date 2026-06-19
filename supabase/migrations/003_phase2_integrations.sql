-- Phase 2: Seed default webhook configurations and integration indexes

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON public.webhook_deliveries(next_retry_at)
  WHERE status IN ('failed', 'retrying');

-- Example webhook configs (inactive by default — activate after setting endpoint URLs)
INSERT INTO public.webhooks (name, provider, endpoint_url, is_active, event_types)
VALUES
  ('GoHighLevel Events', 'gohighlevel', NULL, FALSE, ARRAY['document.processed', 'profile.approved', 'case.stage_changed']),
  ('CRM Sync', 'crm', NULL, FALSE, ARRAY['document.processed', 'profile.approved']),
  ('Internal Notifications', 'internal', NULL, FALSE, ARRAY['contact.unlock_requested', 'contact.approved']);
