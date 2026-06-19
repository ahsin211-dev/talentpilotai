"use client";

import { useEffect, useState } from "react";

type CandidateProfile = {
  candidate_id: string;
  headline: string | null;
  rewritten_summary: string | null;
  key_skills: string[];
  years_experience: number | null;
  country: string | null;
  occupation_code: string | null;
  visa_stage: string | null;
};

export const EmployerCandidateBrowser = () => {
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const load = async () => {
      setPending(true);
      const response = await fetch("/api/employer/candidates");
      const payload = (await response.json()) as {
        error?: string;
        candidates?: CandidateProfile[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Could not load candidates.");
        setPending(false);
        return;
      }

      setCandidates(payload.candidates ?? []);
      setPending(false);
    };

    void load();
  }, []);

  const saveFavourite = async (candidateId: string) => {
    await fetch("/api/employer/favourites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
  };

  const requestUnlock = async (candidateId: string) => {
    await fetch("/api/employer/unlock-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
  };

  if (pending) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading redacted candidates...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="grid gap-4">
      {candidates.map((candidate) => (
        <article
          key={candidate.candidate_id}
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {candidate.headline ?? "Skilled candidate profile"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {candidate.rewritten_summary ?? "Summary pending admin publication."}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <div>
              <dt className="font-semibold">Country</dt>
              <dd>{candidate.country ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Experience</dt>
              <dd>{candidate.years_experience ?? "-"} years</dd>
            </div>
            <div>
              <dt className="font-semibold">Occupation code</dt>
              <dd>{candidate.occupation_code ?? "-"}</dd>
            </div>
            <div>
              <dt className="font-semibold">Visa stage</dt>
              <dd>{candidate.visa_stage ?? "-"}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidate.key_skills?.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {skill}
              </span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void saveFavourite(candidate.candidate_id)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              type="button"
            >
              Save favourite
            </button>
            <button
              onClick={() => void requestUnlock(candidate.candidate_id)}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              type="button"
            >
              Request contact unlock
            </button>
          </div>
        </article>
      ))}
      {candidates.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">No approved redacted profiles yet.</p>
      ) : null}
    </div>
  );
};
