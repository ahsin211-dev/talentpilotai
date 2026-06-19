'use client';

import { useTransition } from 'react';
import { updateCandidateCaseStage } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

interface CaseStageSelectorProps {
  candidateId: string;
  currentStageSlug?: string;
  stages: Array<{ id: string; slug: string; name: string }>;
}

export function CaseStageSelector({ candidateId, currentStageSlug, stages }: CaseStageSelectorProps) {
  const [pending, startTransition] = useTransition();

  function handleChange(slug: string) {
    startTransition(() => {
      void updateCandidateCaseStage(candidateId, slug);
    });
  }

  return (
    <select
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      value={currentStageSlug ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      disabled={pending}
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.slug}>
          {stage.name}
        </option>
      ))}
    </select>
  );
}

interface RetryJobButtonProps {
  jobId: string;
}

export function RetryJobButton({ jobId }: RetryJobButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      await fetch('/api/jobs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={pending}>
      Retry
    </Button>
  );
}

export function RetryWebhooksButton() {
  const [pending, startTransition] = useTransition();

  function handleRetry() {
    startTransition(async () => {
      await fetch('/api/integrations/retry', { method: 'POST' });
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleRetry} disabled={pending}>
      Retry failed webhooks
    </Button>
  );
}
