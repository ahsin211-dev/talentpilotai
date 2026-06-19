import { employerMetrics, sampleProfiles } from "@/lib/mock-data";

export default function EmployerPortalPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Employer portal</span>
        <h1>Browse only redacted, admin-approved candidate profiles.</h1>
        <p>
          Employers can search approved talent, save favourites, and request
          contact unlocks. Sensitive identifiers stay in private tables and are
          unavailable through the UI and direct table queries.
        </p>
      </section>

      <section className="section">
        <h2>Marketplace controls</h2>
        <div className="metric-grid">
          {employerMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <div>{metric.label}</div>
              <p>{metric.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Approved candidate sample</h2>
        <div className="card-grid">
          {sampleProfiles.map((profile) => (
            <article className="candidate-card" key={profile.id}>
              <span className="status-badge">Redacted and approved</span>
              <h3>{profile.displayName}</h3>
              <p>
                {profile.occupation} · {profile.location} · Available in{" "}
                {profile.availability}
              </p>
              <p>{profile.summary}</p>
              <div className="cta-row">
                <span className="button-link secondary">Save favourite</span>
                <span className="button-link secondary">Request unlock</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Access model</h2>
        <div className="card">
          <ul className="list">
            <li>
              Employer browsing should query{" "}
              <code>candidate_profiles_public_redacted</code> only.
            </li>
            <li>
              No direct employer policy exists on{" "}
              <code>candidate_private_details</code> or raw document tables.
            </li>
            <li>
              Contact release occurs through an audited approval path, not by
              exposing private tables.
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
