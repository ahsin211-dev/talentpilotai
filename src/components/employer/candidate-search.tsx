'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function CandidateSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [occupation, setOccupation] = useState(searchParams.get('occupation') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [minExperience, setMinExperience] = useState(searchParams.get('minExperience') ?? '');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (occupation) params.set('occupation', occupation);
    if (country) params.set('country', country);
    if (minExperience) params.set('minExperience', minExperience);
    router.push(`/employer/candidates?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex-1 min-w-[160px]">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Occupation</label>
        <Input
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          placeholder="e.g. Electrician"
        />
      </div>
      <div className="flex-1 min-w-[140px]">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Country</label>
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="e.g. Philippines"
        />
      </div>
      <div className="w-32">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Min. years</label>
        <Input
          type="number"
          min="0"
          value={minExperience}
          onChange={(e) => setMinExperience(e.target.value)}
          placeholder="3"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
