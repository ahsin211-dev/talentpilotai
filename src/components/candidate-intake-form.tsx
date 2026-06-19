"use client";

import { type FormEvent, useState } from "react";

type ApiState = {
  pending: boolean;
  message?: string;
  error?: string;
};

const initialState: ApiState = { pending: false };

export const CandidateIntakeForm = () => {
  const [state, setState] = useState<ApiState>(initialState);

  const submitIntake = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState({ pending: true });

    const payload = {
      givenName: String(formData.get("givenName") ?? ""),
      preferredName: String(formData.get("preferredName") ?? ""),
      surname: String(formData.get("surname") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      countryOfOrigin: String(formData.get("countryOfOrigin") ?? ""),
      currentOccupation: String(formData.get("currentOccupation") ?? ""),
      yearsExperience: Number(formData.get("yearsExperience") || 0),
      consentDataProcessing: formData.get("consentDataProcessing") === "on",
      consentMarketing: formData.get("consentMarketing") === "on",
    };

    const response = await fetch("/api/candidate/intake", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { error?: string; candidateId?: string };

    if (!response.ok) {
      setState({
        pending: false,
        error: result.error ?? "Could not submit intake form.",
      });
      return;
    }

    setState({
      pending: false,
      message: `Intake submitted. Candidate ID: ${result.candidateId ?? "created"}`,
    });
  };

  return (
    <form
      onSubmit={(event) => void submitIntake(event)}
      className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input name="givenName" required placeholder="Given name" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="preferredName" placeholder="Preferred name (optional)" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="surname" required placeholder="Surname" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="email" required type="email" placeholder="Email" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="phone" required placeholder="Phone" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="countryOfOrigin" required placeholder="Country of origin" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input name="currentOccupation" placeholder="Current occupation" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
        <input name="yearsExperience" type="number" min={0} max={60} placeholder="Years experience" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
      </div>

      <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-200">
        <input name="consentDataProcessing" type="checkbox" required className="mt-0.5" />
        <span>I consent to processing of my documents and personal data for migration and recruitment workflows.</span>
      </label>

      <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-200">
        <input name="consentMarketing" type="checkbox" className="mt-0.5" />
        <span>I consent to receiving recruitment-related updates and notifications.</span>
      </label>

      <button
        type="submit"
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        disabled={state.pending}
      >
        {state.pending ? "Submitting..." : "Submit intake"}
      </button>

      {state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
};
