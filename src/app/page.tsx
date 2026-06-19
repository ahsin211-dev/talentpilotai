const securityPillars = [
  "Supabase Auth + Postgres RLS with strict table separation",
  "Encrypted S3 uploads using KMS-backed object storage",
  "Audit logging for sensitive access, review actions, and unlock approvals",
  "AI outputs are queued asynchronously and require admin approval before publishing"
];

const buildPlan = [
  "Phase 1: secure auth, schema, RLS, candidate intake, redacted employer browse, admin review queue",
  "Phase 2: OCR + Claude extraction pipeline, occupation mapping, integrations, and case management",
  "Phase 3: performance, reporting, matching automation, and operational hardening"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">TalentPilot AI</span>
        <h1>Recruitment marketplace foundation built for privacy-sensitive migration workflows.</h1>
        <p>
          This scaffold prioritizes database-enforced access control, encrypted
          document handling, and human-reviewed AI outputs before employers can
          browse candidate talent.
        </p>
        <div className="cta-row">
          <a className="button-link" href="/candidate">
            Candidate portal
          </a>
          <a className="button-link secondary" href="/employer">
            Employer portal
          </a>
          <a className="button-link secondary" href="/admin">
            Admin dashboard
          </a>
        </div>
      </section>

      <section className="section">
        <h2>Implementation plan</h2>
        <div className="card-grid">
          {buildPlan.map((item) => (
            <article className="card" key={item}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Security pillars</h2>
        <ul className="pillars list">
          {securityPillars.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Core regulated data boundaries</h2>
        <div className="portal-grid">
          <article className="card">
            <h3>Candidate portal</h3>
            <p>
              Mobile-first intake, consent capture, encrypted uploads, and case
              progress visibility limited to the candidate&apos;s own records.
            </p>
          </article>
          <article className="card">
            <h3>Employer portal</h3>
            <p>
              Desktop-first shortlist browsing over redacted, admin-approved
              profiles only. No surname, phone, email, ID data, or raw
              documents are available until contact is approved.
            </p>
          </article>
          <article className="card">
            <h3>Admin dashboard</h3>
            <p>
              Review queue for AI outputs, document decisions, case stage
              progression, unlock approvals, and operational audit trails.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
