import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Briefcase, Shield, Users, FileCheck, Globe } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">TalentPilot AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-1.5 text-sm text-teal-700 font-medium mb-6">
            <Shield className="h-4 w-4" />
            Privacy-first recruitment marketplace
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight max-w-4xl mx-auto">
            Connect skilled tradespeople with Australian employers
          </h1>
          <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
            AI-powered document processing, visa case management, and secure candidate matching —
            built for regulated migration and recruitment agencies.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=candidate">
              <Button size="lg" className="w-full sm:w-auto">
                Apply as Candidate
              </Button>
            </Link>
            <Link href="/register?role=employer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Hire as Employer
              </Button>
            </Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Users,
              title: 'Candidate Portal',
              desc: 'Mobile-first intake, document upload, consent collection, and application tracking.',
            },
            {
              icon: Briefcase,
              title: 'Employer Portal',
              desc: 'Browse AI-redacted profiles, save favourites, and request contact with explicit candidate consent.',
            },
            {
              icon: FileCheck,
              title: 'Admin Dashboard',
              desc: 'Review AI extractions, approve profiles, manage cases, and maintain compliance audit trails.',
            },
          ].map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </section>

        <section className="bg-slate-900 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold">Security by design</h2>
            <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
              Row Level Security enforces access at the database level. Employers never see unredacted
              contact details, documents, or raw AI output without explicit candidate approval.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} TalentPilot AI. Australian migration & recruitment platform.
      </footer>
    </div>
  );
}
