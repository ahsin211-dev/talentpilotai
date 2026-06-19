const adminQueues = [
  {
    title: "Document review",
    description: "Approve or reject uploaded CVs, passports, IDs, and qualifications after OCR/AI processing."
  },
  {
    title: "AI extraction review",
    description: "Compare raw OCR and Claude JSON with the redacted profile draft before publishing."
  },
  {
    title: "Contact unlocks",
    description: "Track employer requests and candidate decisions without bypassing candidate approval."
  },
  {
    title: "Compliance audit",
    description: "Review sensitive access logs for signed URLs, contact releases, webhook failures, and admin edits."
  }
];

export default function AdminDashboardPage() {
  return (
    <div className="page">
      <section className="section">
        <span className="status-pill">Internal admin dashboard</span>
        <h1>Human review before any profile reaches employers.</h1>
        <p className="section-lede">
          Admin publishing uses <code>/api/admin/review/[candidateId]/publish</code>, which writes approval metadata and
          flips employer visibility only for redacted records.
        </p>
      </section>

      <section className="grid" aria-label="Admin queues">
        {adminQueues.map((queue) => (
          <article className="card" key={queue.title}>
            <h2>{queue.title}</h2>
            <p>{queue.description}</p>
          </article>
        ))}
      </section>

      <section className="card risk">
        <h2>Security-critical guardrail</h2>
        <p>
          Admins must never copy raw AI output or private identifiers into employer-visible summaries. RLS and grants
          protect private tables, but admin review discipline and audit monitoring are still required controls.
        </p>
      </section>
    </div>
  );
}
