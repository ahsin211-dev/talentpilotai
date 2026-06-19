'use client';

import { useTransition } from 'react';
import { approveDocument } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

export function DocumentReviewActions({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => { void approveDocument(documentId, true); })}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void approveDocument(documentId, false, 'Does not meet requirements');
          })
        }
      >
        Reject
      </Button>
    </div>
  );
}
