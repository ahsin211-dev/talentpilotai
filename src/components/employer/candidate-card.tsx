'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toggleFavourite, requestContactUnlock } from '@/app/actions/employer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, MapPin, Briefcase } from 'lucide-react';
import type { RedactedProfile } from '@/types/database';

interface CandidateCardProps {
  profile: RedactedProfile;
  isFavourite: boolean;
}

export function CandidateCard({ profile, isFavourite }: CandidateCardProps) {
  const [favourite, setFavourite] = useState(isFavourite);
  const [unlockSent, setUnlockSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFavourite() {
    const result = await toggleFavourite(profile.candidate_id);
    if (result.success) setFavourite(!favourite);
  }

  async function handleUnlock() {
    setLoading(true);
    const result = await requestContactUnlock({ candidateId: profile.candidate_id });
    if (result.success) setUnlockSent(true);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{profile.display_name}</CardTitle>
            <p className="text-sm text-slate-500 mt-0.5">{profile.headline}</p>
          </div>
          <button
            onClick={handleFavourite}
            className="p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Toggle favourite"
          >
            <Heart
              className={`h-5 w-5 ${favourite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
            />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {profile.summary && (
          <p className="text-sm text-slate-600 line-clamp-3">{profile.summary}</p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {profile.occupation_title && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {profile.occupation_title}
            </span>
          )}
          {profile.country_of_origin && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {profile.country_of_origin}
            </span>
          )}
        </div>

        {profile.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {profile.skills.slice(0, 4).map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Link href={`/employer/candidates/${profile.candidate_id}`} className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              View profile
            </Button>
          </Link>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleUnlock}
            disabled={loading || unlockSent}
          >
            {unlockSent ? 'Request sent' : 'Request contact'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
