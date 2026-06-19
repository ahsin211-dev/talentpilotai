"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveIntake, uploadDocument, respondToUnlock, type ActionResult } from "@/lib/candidate/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function Feedback({ state, success }: { state: ActionResult; success: string }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-green-600">{success}</p>;
  return null;
}

export function IntakeForm({ defaults }: { defaults?: Record<string, string | number | null> }) {
  const [state, action] = useFormState(saveIntake, null);
  const d = defaults ?? {};
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" required className="input" defaultValue={d.firstName ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="lastName">Surname (kept private)</label>
          <input id="lastName" name="lastName" required className="input" defaultValue={d.lastName ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email (kept private)</label>
          <input id="email" name="email" type="email" required className="input" defaultValue={d.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (kept private)</label>
          <input id="phone" name="phone" required className="input" defaultValue={d.phone ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="country">Country</label>
          <input id="country" name="country" required className="input" defaultValue={d.country ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="nationality">Nationality</label>
          <input id="nationality" name="nationality" className="input" defaultValue={d.nationality ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="occupationTitle">Occupation / trade</label>
          <input id="occupationTitle" name="occupationTitle" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="yearsExperience">Years of experience</label>
          <input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} required className="input" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="consentGiven" className="mt-1" required />
        I consent to TalentPilotAI processing my documents and creating a redacted profile for Australian employers.
      </label>
      <Feedback state={state} success="Intake saved. You can now upload documents." />
      <Submit label="Save intake" />
    </form>
  );
}

export function UploadForm() {
  const [state, action] = useFormState(uploadDocument, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="documentType">Document type</label>
        <select id="documentType" name="documentType" className="input" required>
          <option value="cv">CV / Résumé</option>
          <option value="passport">Passport</option>
          <option value="national_id">National ID</option>
          <option value="qualification">Qualification</option>
          <option value="certificate">Certificate</option>
          <option value="reference">Reference</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="file">File (PDF / image / DOCX, max 25 MB)</label>
        <input id="file" name="file" type="file" required className="input"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
      </div>
      <Feedback state={state} success="Uploaded securely. AI processing has started." />
      <Submit label="Upload document" />
    </form>
  );
}

export function UnlockResponse({ requestId }: { requestId: string }) {
  const [state, action] = useFormState(respondToUnlock, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="consentText" value="I consent to be contacted by this employer." />
      <button type="submit" name="approve" value="true" className="btn-primary">Approve contact</button>
      <button type="submit" name="approve" value="false" className="btn-secondary">Decline</button>
      {state?.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
    </form>
  );
}
