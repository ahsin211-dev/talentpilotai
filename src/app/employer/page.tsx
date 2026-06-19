import { EmployerCandidateBrowser } from "@/components/employer-candidate-browser";

export default function EmployerPortalPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Employer Portal
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl dark:text-zinc-100">
          Redacted candidate marketplace
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Contact details remain hidden until explicit candidate approval is recorded and validated
          through database-level authorization.
        </p>
      </header>

      <EmployerCandidateBrowser />
    </main>
  );
}
