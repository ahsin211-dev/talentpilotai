"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signIn, signUpCandidate, signUpEmployer, type FormState } from "@/lib/auth/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

function ErrorText({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-red-600">{state.error}</p>;
}

export function LoginForm() {
  const [state, action] = useFormState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="input" />
      </div>
      <ErrorText state={state} />
      <SubmitButton label="Sign in" />
    </form>
  );
}

export function CandidateSignupForm() {
  const [state, action] = useFormState(signUpCandidate, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (min 8 characters)</label>
        <input id="password" name="password" type="password" minLength={8} required className="input" />
      </div>
      <ErrorText state={state} />
      <SubmitButton label="Create candidate account" />
    </form>
  );
}

export function EmployerSignupForm() {
  const [state, action] = useFormState(signUpEmployer, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="companyName">Company name</label>
        <input id="companyName" name="companyName" required className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="abn">ABN (optional)</label>
          <input id="abn" name="abn" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="contactName">Contact name</label>
          <input id="contactName" name="contactName" required className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="contactEmail">Contact email</label>
        <input id="contactEmail" name="contactEmail" type="email" required className="input" />
      </div>
      <hr className="border-slate-200" />
      <div>
        <label className="label" htmlFor="email">Login email</label>
        <input id="email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (min 8 characters)</label>
        <input id="password" name="password" type="password" minLength={8} required className="input" />
      </div>
      <ErrorText state={state} />
      <SubmitButton label="Create employer account" />
    </form>
  );
}
