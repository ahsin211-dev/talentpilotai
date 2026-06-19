import { candidateMetrics } from "@/lib/mock-data";

export default function CandidatePortalPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Candidate portal</span>
        <h1>Mobile-first intake for skilled trades candidates.</h1>
        <p>
          Intake is designed around consent, secure uploads, and case visibility
          without exposing service credentials or bypassing review workflows.
        </p>
        <div className="badge-row">
          <span className="badge">Step 1: create account</span>
          <span className="badge">Step 2: submit intake</span>
          <span className="badge">Step 3: upload documents</span>
          <span className="badge">Step 4: track case review</span>
        </div>
      </section>

      <section className="section">
        <h2>Current workflow snapshot</h2>
        <div className="metric-grid">
          {candidateMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <div>{metric.label}</div>
              <p>{metric.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Secure intake API contract</h2>
        <div className="card">
          <p>
            Submit onboarding details to <code>POST /api/candidate/intake</code>,
            then request a signed document upload URL from{" "}
            <code>POST /api/candidate/documents/presign</code>. Files are
            validated for MIME type and size before a KMS-backed S3 URL is
            returned.
          </p>
          <ul className="list">
            <li>Consent must be explicitly accepted.</li>
            <li>Private details and public redacted profile data are stored separately.</li>
            <li>Uploads trigger an async document processing job for OCR and AI review.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
