"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitCandidateIntake } from "../actions";

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("consentGiven", consent ? "true" : "false");

    const result = await submitCandidateIntake(formData);

    setLoading(false);

    if (result.error) {
      setError(typeof result.error === "string" ? result.error : "Please check all fields");
      return;
    }

    router.push("/candidate");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Welcome to TalentPilot</h1>
          <p className="mt-2 text-sm text-slate-600">
            Complete your profile to start your Australian migration journey
          </p>
        </div>

        <Card title="Personal details">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input id="firstName" name="firstName" label="First name" required />
            <Input id="surname" name="surname" label="Surname" required />
            <Input id="email" name="email" label="Email" type="email" required />
            <Input id="phone" name="phone" label="Phone (optional)" type="tel" />
            <Input id="country" name="country" label="Country of origin" required />
            <Input id="dateOfBirth" name="dateOfBirth" label="Date of birth" type="date" />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1"
                  required
                />
                <span className="text-sm text-slate-700">
                  I consent to TalentPilot collecting and processing my personal information
                  for recruitment and migration purposes. I understand my data will be
                  redacted before being shared with employers, and employers can only access
                  my full contact details with my explicit approval.
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" loading={loading} disabled={!consent}>
              Continue to document upload
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
