import Link from "next/link";
import { TopNav } from "@/components/ui";

const FEATURES = [
  {
    title: "Privacy by design",
    body: "Candidate surname, contact details and ID documents are physically separated and enforced by Postgres Row Level Security — never visible to employers without explicit consent.",
  },
  {
    title: "AI document pipeline",
    body: "Uploads are OCR'd, structured by Claude, rewritten to AU standard, mapped to ANZSCO codes and redacted — then held for human review before publishing.",
  },
  {
    title: "Consent-gated contact",
    body: "Employers can request contact; details unlock only after the candidate explicitly approves, with every access audit-logged.",
  },
];

export default function HomePage() {
  return (
    <div>
      <TopNav
        title="TalentPilotAI"
        links={[
          { href: "/login", label: "Sign in" },
          { href: "/signup/candidate", label: "I'm a candidate" },
          { href: "/signup/employer", label: "I'm an employer" },
        ]}
      />
      <main className="mx-auto max-w-7xl px-6">
        <section className="py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            Australian skilled-trades recruitment
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            Connect overseas skilled tradespeople with Australian employers — safely.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            A regulated, privacy-first marketplace with an AI document pipeline and
            visa/immigration case management built in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup/candidate" className="btn-primary">
              Start your candidate profile
            </Link>
            <Link href="/signup/employer" className="btn-secondary">
              Browse candidates as an employer
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-16 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        TalentPilotAI — security-first recruitment platform.
      </footer>
    </div>
  );
}
