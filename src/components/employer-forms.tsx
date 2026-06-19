"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  toggleFavourite,
  requestUnlock,
  revealContact,
  startCheckout,
  type ActionResult,
} from "@/lib/employer/actions";

function Submit({ label, variant = "primary" }: { label: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={variant === "primary" ? "btn-primary" : "btn-secondary"} disabled={pending}>
      {pending ? "…" : label}
    </button>
  );
}

export function FavouriteButton({ profileId, isFavourite }: { profileId: string; isFavourite: boolean }) {
  const [state, action] = useFormState(toggleFavourite, null);
  void state;
  return (
    <form action={action}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="remove" value={String(isFavourite)} />
      <Submit label={isFavourite ? "★ Saved" : "☆ Save"} variant="secondary" />
    </form>
  );
}

export function UnlockRequestForm({
  candidateId,
  profileId,
}: {
  candidateId: string;
  profileId: string;
}) {
  const [state, action] = useFormState(requestUnlock, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <input type="hidden" name="candidateProfileId" value={profileId} />
      <textarea name="message" className="input" rows={2} placeholder="Optional message to the candidate" />
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-green-600">Request sent. You&apos;ll be notified when the candidate responds.</p> : null}
      <Submit label="Request contact" />
    </form>
  );
}

export function RevealContactButton({ candidateId }: { candidateId: string }) {
  const [result, setResult] = useState<null | { error?: string; contact?: Record<string, string | null> }>(null);
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const res = await revealContact(candidateId);
    setResult(res.ok ? { contact: res.contact } : { error: res.error });
    setLoading(false);
  }

  if (result?.contact) {
    const c = result.contact;
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
        <p className="font-medium text-green-800">Contact unlocked</p>
        <p>{c.first_name} {c.last_name}</p>
        <p>{c.email}</p>
        <p>{c.phone}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button onClick={onClick} className="btn-primary" disabled={loading}>
        {loading ? "Checking…" : "Reveal contact details"}
      </button>
      {result?.error ? <p className="text-sm text-amber-700">{result.error}</p> : null}
    </div>
  );
}

export function BillingButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onClick() {
    setLoading(true);
    const res = await startCheckout();
    if (res.url) {
      window.location.href = res.url;
    } else {
      setError(res.error ?? "Could not start checkout");
      setLoading(false);
    }
  }
  return (
    <div className="space-y-2">
      <button onClick={onClick} className="btn-primary" disabled={loading}>
        {loading ? "Redirecting…" : "Subscribe"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function SearchForm({ defaults }: { defaults: Record<string, string> }) {
  return (
    <form className="grid gap-3 sm:grid-cols-4" method="get">
      <input name="q" defaultValue={defaults.q} className="input sm:col-span-2" placeholder="Search skills, occupation…" />
      <input name="country" defaultValue={defaults.country} className="input" placeholder="Country" />
      <input name="minExperience" defaultValue={defaults.minExperience} type="number" min={0} className="input" placeholder="Min years" />
      <div className="sm:col-span-4">
        <button type="submit" className="btn-primary">Search</button>
      </div>
    </form>
  );
}
