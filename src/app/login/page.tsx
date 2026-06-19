import Link from "next/link";
import { LoginForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-center text-xl font-semibold text-brand-700">
        TalentPilotAI
      </Link>
      <div className="card">
        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-6 text-sm text-slate-500">Access your candidate, employer or admin portal.</p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link href="/signup/candidate" className="text-brand-700 hover:underline">Candidate</Link>{" "}·{" "}
          <Link href="/signup/employer" className="text-brand-700 hover:underline">Employer</Link>
        </p>
      </div>
    </div>
  );
}
