"use client";

import { useFormState, useFormStatus } from "react-dom";
import { reviewExtraction, setCaseStage, retryJob, type ActionResult } from "@/lib/admin/actions";

function Submit({ label, name, value, variant = "primary" }: { label: string; name?: string; value?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} className={variant === "primary" ? "btn-primary" : "btn-secondary"} disabled={pending}>
      {pending ? "…" : label}
    </button>
  );
}

export function ReviewForm({
  aiResultId,
  suggested,
  occupations,
}: {
  aiResultId: string;
  suggested: {
    displayName?: string;
    headline?: string;
    summary?: string;
    occupationTitle?: string;
    skills?: string[];
    yearsExperience?: number;
    countryOfOrigin?: string;
  };
  occupations: { id: string; code: string; title: string }[];
}) {
  const [state, action] = useFormState(reviewExtraction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="aiResultId" value={aiResultId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Display name (no surname)</label>
          <input name="displayName" className="input" defaultValue={suggested.displayName ?? ""} />
        </div>
        <div>
          <label className="label">Headline</label>
          <input name="headline" className="input" defaultValue={suggested.headline ?? ""} />
        </div>
        <div>
          <label className="label">Occupation title</label>
          <input name="occupationTitle" className="input" defaultValue={suggested.occupationTitle ?? ""} />
        </div>
        <div>
          <label className="label">Occupation code</label>
          <select name="occupationCodeId" className="input" defaultValue="">
            <option value="">— select —</option>
            {occupations.map((o) => (
              <option key={o.id} value={o.id}>{o.code} · {o.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Years experience</label>
          <input name="yearsExperience" type="number" min={0} className="input" defaultValue={suggested.yearsExperience ?? ""} />
        </div>
        <div>
          <label className="label">Country of origin</label>
          <input name="countryOfOrigin" className="input" defaultValue={suggested.countryOfOrigin ?? ""} />
        </div>
      </div>
      <div>
        <label className="label">Skills (comma separated)</label>
        <input name="skills" className="input" defaultValue={(suggested.skills ?? []).join(", ")} />
      </div>
      <div>
        <label className="label">Redacted summary</label>
        <textarea name="summary" rows={4} className="input" defaultValue={suggested.summary ?? ""} />
      </div>
      <div>
        <label className="label">Reviewer notes</label>
        <textarea name="reviewerNotes" rows={2} className="input" />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
      <div className="flex gap-2">
        <Submit label="Approve & publish" name="decision" value="approve" />
        <Submit label="Save edits" name="decision" value="edit" variant="secondary" />
        <Submit label="Reject" name="decision" value="reject" variant="secondary" />
      </div>
    </form>
  );
}

export function CaseStageForm({ candidateId }: { candidateId: string }) {
  const [state, action] = useFormState(setCaseStage, null);
  const stages = [
    "intake", "document_review", "ai_processing", "admin_review",
    "profile_published", "employer_matching", "contact_approved",
    "placed", "rejected", "withdrawn",
  ];
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <div>
        <label className="label">Set stage</label>
        <select name="stage" className="input">
          {stages.map((s) => <option key={s} value={s}>{s.replace(/_/gu, " ")}</option>)}
        </select>
      </div>
      <input name="notes" className="input flex-1" placeholder="Notes" />
      <Submit label="Update" variant="secondary" />
      {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function RetryJobButton({ jobId }: { jobId: string }) {
  const [state, action] = useFormState(retryJob, null);
  void state;
  return (
    <form action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <Submit label="Requeue" variant="secondary" />
    </form>
  );
}
