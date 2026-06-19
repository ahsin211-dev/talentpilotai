import { CandidateDocumentUpload } from "@/components/candidate-document-upload";
import { CandidateIntakeForm } from "@/components/candidate-intake-form";

export default function CandidatePortalPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Candidate Portal
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl dark:text-zinc-100">
          Mobile-first onboarding and secure document intake
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Your uploaded data remains private until reviewed and approved under compliance controls.
        </p>
      </header>

      <section className="space-y-6">
        <CandidateIntakeForm />
        <CandidateDocumentUpload />
      </section>
    </main>
  );
}
