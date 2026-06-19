"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { employerRegisterSchema } from "@/lib/validation/schemas";

export default function EmployerOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      companyName: formData.get("companyName"),
      abn: formData.get("abn") || undefined,
      industry: formData.get("industry") || undefined,
      contactFirstName: formData.get("contactFirstName"),
      contactSurname: formData.get("contactSurname"),
      contactEmail: formData.get("contactEmail"),
      contactPhone: formData.get("contactPhone") || undefined,
    };

    const parsed = employerRegisterSchema.safeParse(data);
    if (!parsed.success) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/employer/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Failed to save");
      setLoading(false);
      return;
    }

    router.push("/employer/subscription");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg" title="Employer account setup">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="companyName" name="companyName" label="Company name" required />
          <Input id="abn" name="abn" label="ABN (optional)" />
          <Input id="industry" name="industry" label="Industry (optional)" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="contactFirstName" name="contactFirstName" label="Contact first name" required />
            <Input id="contactSurname" name="contactSurname" label="Contact surname" required />
          </div>
          <Input id="contactEmail" name="contactEmail" label="Contact email" type="email" required />
          <Input id="contactPhone" name="contactPhone" label="Contact phone" type="tel" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Continue to subscription
          </Button>
        </form>
      </Card>
    </div>
  );
}
