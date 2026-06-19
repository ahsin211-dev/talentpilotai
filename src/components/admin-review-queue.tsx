"use client";

import { useEffect, useState } from "react";

type QueueProfile = {
  candidate_id: string;
  profile_status: string;
  confidence_score: number | null;
  headline: string | null;
};

type QueueDocument = {
  id: string;
  candidate_id: string;
  document_type: string;
  processing_status: string;
};

export const AdminReviewQueue = () => {
  const [profiles, setProfiles] = useState<QueueProfile[]>([]);
  const [documents, setDocuments] = useState<QueueDocument[]>([]);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const loadQueue = async () => {
      setPending(true);
      const response = await fetch("/api/admin/review-queue");
      const payload = (await response.json()) as {
        error?: string;
        profiles?: QueueProfile[];
        documents?: QueueDocument[];
      };

      if (!response.ok) {
        setError(payload.error ?? "Unable to load review queue.");
        setPending(false);
        return;
      }

      setProfiles(payload.profiles ?? []);
      setDocuments(payload.documents ?? []);
      setPending(false);
    };

    void loadQueue();
  }, []);

  const approveProfile = async (candidateId: string) => {
    await fetch(`/api/admin/review-queue/${candidateId}/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        decision: "approved",
      }),
    });
  };

  if (pending) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading review queue...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
          Profile approval queue
        </h3>
        <div className="mt-4 grid gap-3">
          {profiles.map((profile) => (
            <article key={profile.candidate_id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-sm font-semibold">{profile.headline ?? "No headline yet"}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Candidate {profile.candidate_id.slice(0, 8)} | Status: {profile.profile_status} |
                Confidence: {profile.confidence_score ?? "n/a"}
              </p>
              <button
                type="button"
                onClick={() => void approveProfile(profile.candidate_id)}
                className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
              >
                Approve and publish
              </button>
            </article>
          ))}
          {profiles.length === 0 ? (
            <p className="text-xs text-zinc-500">No profile reviews pending.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
          Document review queue
        </h3>
        <div className="mt-4 grid gap-3">
          {documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-sm font-semibold">
                {document.document_type} | {document.processing_status}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-300">
                Candidate {document.candidate_id.slice(0, 8)}
              </p>
            </article>
          ))}
          {documents.length === 0 ? (
            <p className="text-xs text-zinc-500">No document reviews pending.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
};
