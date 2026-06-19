import { AdminReviewQueue } from "@/components/admin-review-queue";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Admin Dashboard
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl dark:text-zinc-100">
          Compliance review and case progression
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          AI extraction output is always reviewed by humans before redacted profile publication.
        </p>
      </header>
      <AdminReviewQueue />
    </main>
  );
}
