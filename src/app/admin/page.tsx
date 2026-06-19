import { adminMetrics } from "@/lib/mock-data";

const reviewQueue = [
  {
    candidate: "Joseph M.",
    document: "CV",
    status: "Awaiting reviewer approval",
    confidence: "0.86"
  },
  {
    candidate: "Fatima A.",
    document: "Passport",
    status: "Manual review required",
    confidence: "0.51"
  }
];

export default function AdminDashboardPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">Admin dashboard</span>
        <h1>Review AI extraction outputs before employers see anything.</h1>
        <p>
          Admins approve redacted profiles, manage case stages, review failed
          jobs, and investigate audit logs without giving employers visibility
          into raw documents or candidate private details.
        </p>
      </section>

      <section className="section">
        <h2>Operations snapshot</h2>
        <div className="metric-grid">
          {adminMetrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <strong>{metric.value}</strong>
              <div>{metric.label}</div>
              <p>{metric.hint}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Review queue</h2>
        <div className="card">
          <table className="table-lite">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Document</th>
                <th>Status</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((item) => (
                <tr key={`${item.candidate}-${item.document}`}>
                  <td>{item.candidate}</td>
                  <td>{item.document}</td>
                  <td>{item.status}</td>
                  <td>{item.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
