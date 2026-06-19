'use client';

import { useTransition } from 'react';
import { approveProfile, createRedactedProfileFromCandidate } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

export function CreateProfileButton({ candidateId }: { candidateId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => { void createRedactedProfileFromCandidate(candidateId); })}
    >
      Create profile
    </Button>
  );
}

export function ProfileApprovalActions({ profileId }: { profileId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 mt-4">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => { void approveProfile({ profileId, approved: true }); })}
      >
        Approve for employers
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void approveProfile({
              profileId,
              approved: false,
              rejectionReason: 'Needs more information',
            });
          })
        }
      >
        Reject
      </Button>
    </div>
  );
}
