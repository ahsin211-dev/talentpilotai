import Link from "next/link";

const platformPillars = [
  "Supabase Auth, Postgres, and RLS for database-enforced access control",
  "Encrypted S3 document storage with short-lived signed URLs",
  "Human-reviewed AI extraction before employer visibility",
  "Stripe-gated employer subscriptions and contact unlock workflows",
  "Audit logging for sensitive profile, contact, and document access"
];

export default function HomePage() {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Privacy-first recruitment marketplace for migration-ready trades.</h1>
          <p>
            Connect overseas skilled workers with Australian employers while keeping passports, contact details, and
            unreviewed AI output behind strict server-side controls.
          </p>
          <div className="actions">
            <Link className="button" href="/candidate">
              Start candidate intake
            </Link>
            <Link className="button secondary" href="/employer">
              Browse employer portal
            </Link>
          </div>
        </div>
        <div className="card">
          <h2>MVP security posture</h2>
          <ul>
            {platformPillars.map((pillar) => (
              <li key={pillar}>{pillar}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid" aria-label="Portal overview">
        <article className="card">
          <h3>Candidate portal</h3>
          <p>Mobile-first intake, consent capture, CV/passport/qualification uploads, and case status tracking.</p>
        </article>
        <article className="card">
          <h3>Employer portal</h3>
          <p>
            Subscription-gated access to approved redacted profiles, favourites, and candidate-approved unlock requests.
          </p>
        </article>
        <article className="card">
          <h3>Admin dashboard</h3>
          <p>Review queues for documents and AI results, redacted profile publishing, case stage updates, and audits.</p>
        </article>
      </section>
    </div>
  );
}
