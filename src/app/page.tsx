import { PortalCard } from "@/components/portal-card";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 md:px-8 md:py-10">
      <main className="flex flex-1 flex-col gap-8">
        <section className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            TalentPilot AI
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-5xl dark:text-zinc-100">
            Secure Recruitment & Migration Marketplace
          </h1>
          <p className="max-w-3xl text-base leading-7 text-zinc-600 md:text-lg dark:text-zinc-300">
            Privacy-first platform connecting overseas skilled tradespeople with Australian
            employers. Every sensitive action is server-authorized, redaction-gated, and audit
            logged.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <PortalCard
            href="/candidate"
            title="Candidate Portal"
            audience="Mobile-first"
            description="Submit intake data, upload documents with encrypted storage, and track migration case progress."
          />
          <PortalCard
            href="/employer"
            title="Employer Portal"
            audience="Desktop-first"
            description="Browse approved redacted profiles, save favourites, and request contact unlock with consent workflow."
          />
          <PortalCard
            href="/admin"
            title="Admin Dashboard"
            audience="Internal operations"
            description="Review AI outputs, approve redacted profiles, manage case stages, and monitor compliance audit logs."
          />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
          Security invariant: employers cannot access private candidate details unless explicit
          candidate approval exists and database RLS permits access.
        </section>
      </main>
    </div>
  );
}
