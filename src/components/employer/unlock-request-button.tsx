'use client';

import { useState } from 'react';
import { requestContactUnlock } from '@/app/actions/employer';
import { Button } from '@/components/ui/button';

export function UnlockRequestButton({ candidateId }: { candidateId: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await requestContactUnlock({ candidateId });
    if (result.success) setSent(true);
    setLoading(false);
  }

  return (
    <Button onClick={handleClick} disabled={loading || sent} size="sm">
      {sent ? 'Request sent' : 'Request contact'}
    </Button>
  );
}
