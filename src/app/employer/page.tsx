const redactedProfileFields = [
  "Display name only, never surname",
  "Country, occupation, experience, skills, qualifications, and visa stage",
  "Admin-approved professional summary rewritten for Australian market",
  "No phone, email, address, passport number, ID number, or raw documents"
];

const candidateCards = [
  {
    displayName: "Candidate A.",
    trade: "Boilermaker",
    country: "South Africa",
    experience: "9 years",
    visaStage: "Documents pending",
    skills: ["MIG welding", "Fabrication", "Shutdown maintenance"]
  },
  {
    displayName: "Candidate B.",
    trade: "Diesel mechanic",
    country: "Philippines",
    experience: "7 years",
    visaStage: "Admin reviewed",
    skills: ["Heavy vehicles", "Diagnostics", "Preventative maintenance"]
  }
];

export default function EmployerPortalPage() {
  return (
    <div className="page">
      <section className="section">
        <span className="status-pill">Subscription-gated employer portal</span>
        <h1>Browse approved redacted profiles without exposing private data.</h1>
        <p className="section-lede">
          The employer API reads only <code>candidate_profiles_public_redacted</code>. Contact details are available only
          from an audited database function after candidate approval.
        </p>
      </section>

      <div className="portal-layout">
        <aside className="card">
          <h2>Employer-visible fields</h2>
          <ul>
            {redactedProfileFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </aside>

        <section className="grid" aria-label="Example redacted candidate cards">
          {candidateCards.map((candidate) => (
            <article className="card" key={candidate.displayName}>
              <span className="status-pill">{candidate.visaStage}</span>
              <h2>{candidate.displayName}</h2>
              <p>
                {candidate.trade} based in {candidate.country} with {candidate.experience} experience.
              </p>
              <p>{candidate.skills.join(" • ")}</p>
              <div className="actions">
                <button className="button" type="button">
                  Save favourite
                </button>
                <button className="button" type="button">
                  Request contact unlock
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
