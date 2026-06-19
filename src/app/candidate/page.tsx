const intakeSteps = [
  "Create account with candidate role",
  "Submit identity and trade intake with explicit consent",
  "Upload CV, passport/ID, and qualifications through encrypted signed URLs",
  "Track document review, AI extraction, employer visibility, and visa case stages"
];

export default function CandidatePortalPage() {
  return (
    <div className="page">
      <section className="section">
        <span className="status-pill">Mobile-first candidate portal</span>
        <h1>Secure intake for overseas skilled tradespeople.</h1>
        <p className="section-lede">
          This MVP wires the backend intake and document upload APIs. Auth UI can be connected to Supabase Auth screens
          or embedded with passwordless OTP in the next iteration.
        </p>
      </section>

      <div className="portal-layout">
        <aside className="card">
          <h2>Onboarding checklist</h2>
          <ol>
            {intakeSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </aside>

        <section className="card">
          <h2>Candidate intake payload</h2>
          <p>
            Submit this form to <code>/api/candidate/intake</code> after Supabase login. The route writes public
            candidate metadata separately from private surname/contact fields and records consent.
          </p>
          <form className="form-grid">
            <label>
              Given name
              <input name="givenName" placeholder="Ari" />
            </label>
            <label>
              Surname (private)
              <input name="surname" placeholder="Stored outside employer-visible tables" />
            </label>
            <label>
              Email (private)
              <input name="email" type="email" placeholder="candidate@example.com" />
            </label>
            <label>
              Primary trade
              <input name="primaryTrade" placeholder="Diesel mechanic" />
            </label>
            <label>
              Country of residence
              <input name="countryOfResidence" placeholder="Philippines" />
            </label>
            <label>
              Consent
              <select name="consentAccepted" defaultValue="true">
                <option value="true">I consent to document processing and regulated recruitment review</option>
              </select>
            </label>
          </form>
        </section>
      </div>
    </div>
  );
}
