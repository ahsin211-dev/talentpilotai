import Link from "next/link";
import { EmployerSignupForm } from "@/components/forms";

export default function EmployerSignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-6 text-center text-xl font-semibold text-brand-700">
        TalentPilotAI
      </Link>
      <div className="card">
        <h1 className="mb-1 text-xl font-semibold">Create an employer account</h1>
        <p className="mb-6 text-sm text-slate-500">
          Browse AI-processed, redacted candidate profiles. A subscription is required to unlock contact requests.
        </p>
        <EmployerSignupForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered? <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
