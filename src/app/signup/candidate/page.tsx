import Link from "next/link";
import { CandidateSignupForm } from "@/components/forms";

export default function CandidateSignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-center text-xl font-semibold text-brand-700">
        TalentPilotAI
      </Link>
      <div className="card">
        <h1 className="mb-1 text-xl font-semibold">Create your candidate profile</h1>
        <p className="mb-6 text-sm text-slate-500">
          Your private details are encrypted and never shared with employers without your explicit consent.
        </p>
        <CandidateSignupForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered? <Link href="/login" className="text-brand-700 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
