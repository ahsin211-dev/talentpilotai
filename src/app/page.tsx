import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Briefcase, Shield, Users, FileCheck, Globe } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Globe className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-slate-900">TalentPilot AI</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-blue-50 to-white px-4 py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Australian Skilled Migration Recruitment, Done Right
            </h1>
            <p className="mt-6 text-lg text-slate-600">
              Connect overseas skilled tradespeople with Australian employers through a
              secure, privacy-first platform with AI-powered document processing and
              full visa case management.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register?role=candidate">
                <Button size="lg" className="w-full sm:w-auto">
                  I&apos;m a Candidate
                </Button>
              </Link>
              <Link href="/register?role=employer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  I&apos;m an Employer
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">
            Built for regulated, privacy-sensitive recruitment
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Shield,
                title: "Privacy by Design",
                desc: "Row-level security ensures employers never see unredacted candidate data without explicit consent.",
              },
              {
                icon: FileCheck,
                title: "AI Document Processing",
                desc: "OCR and Claude-powered extraction with mandatory admin review before employer visibility.",
              },
              {
                icon: Users,
                title: "Three Secure Portals",
                desc: "Dedicated candidate, employer, and admin experiences with role-based access control.",
              },
              {
                icon: Briefcase,
                title: "Case Management",
                desc: "Track visa stages, document approvals, and contact unlock requests end to end.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-6">
                <Icon className="h-8 w-8 text-blue-600" />
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} TalentPilot AI. All rights reserved.
      </footer>
    </div>
  );
}
