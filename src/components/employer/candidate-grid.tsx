"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  candidate_id: string;
  display_first_name: string;
  professional_summary: string | null;
  occupation_title: string | null;
  skills: string[];
  years_experience: number | null;
  country_of_origin: string | null;
  visa_stage: string | null;
  occupation_codes: { code: string; title: string } | null;
}

export function CandidateGrid({
  profiles,
  favouriteIds,
  employerId,
}: {
  profiles: Profile[];
  favouriteIds: Set<string>;
  employerId: string;
}) {
  if (profiles.length === 0) {
    return (
      <Card>
        <p className="text-center text-slate-500">
          No approved candidate profiles available yet. Check back soon.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => (
        <CandidateCard
          key={profile.id}
          profile={profile}
          isFavourite={favouriteIds.has(profile.candidate_id)}
          employerId={employerId}
        />
      ))}
    </div>
  );
}

function CandidateCard({
  profile,
  isFavourite,
  employerId,
}: {
  profile: Profile;
  isFavourite: boolean;
  employerId: string;
}) {
  const router = useRouter();
  const [fav, setFav] = useState(isFavourite);
  const [unlocking, setUnlocking] = useState(false);
  const [message, setMessage] = useState("");

  async function toggleFavourite() {
    const method = fav ? "DELETE" : "POST";
    await fetch("/api/employer/favourites", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employerId,
        candidateId: profile.candidate_id,
      }),
    });
    setFav(!fav);
    router.refresh();
  }

  async function requestUnlock() {
    setUnlocking(true);
    const res = await fetch("/api/employer/unlock-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: profile.candidate_id,
        message: message || undefined,
      }),
    });
    setUnlocking(false);
    if (res.ok) {
      alert("Contact request sent. The candidate will be notified.");
    } else {
      const data = await res.json();
      alert(data.error ?? "Request failed");
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{profile.display_first_name}</h3>
          <p className="text-sm text-slate-500">
            {profile.occupation_title ?? profile.occupation_codes?.title ?? "Skilled tradesperson"}
          </p>
        </div>
        <button onClick={toggleFavourite} className="text-slate-400 hover:text-red-500">
          <Heart className={`h-5 w-5 ${fav ? "fill-red-500 text-red-500" : ""}`} />
        </button>
      </div>

      {profile.professional_summary && (
        <p className="mt-3 line-clamp-3 text-sm text-slate-600">
          {profile.professional_summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {profile.skills?.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        {profile.country_of_origin && <span>From: {profile.country_of_origin}</span>}
        {profile.years_experience != null && (
          <span>{profile.years_experience} yrs exp</span>
        )}
        {profile.visa_stage && <span>Visa: {profile.visa_stage}</span>}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <input
          type="text"
          placeholder="Optional message to candidate"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mb-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          loading={unlocking}
          onClick={requestUnlock}
        >
          <MessageSquare className="mr-1 h-3 w-3" />
          Request contact
        </Button>
      </div>
    </Card>
  );
}
