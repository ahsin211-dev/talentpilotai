import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  in_review: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  dead_letter: "bg-red-100 text-red-800",
  registered: "bg-slate-100 text-slate-700",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${style}`}>{status.replace(/_/gu, " ")}</span>;
}

export function TopNav({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          {title}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-600 hover:text-brand-700">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-center text-sm text-slate-500">{message}</div>
  );
}

export function ConfigNotice() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      Supabase is not configured in this environment. Set
      <code className="mx-1 rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>
      and related keys (see <code>.env.example</code>) to enable live data.
    </div>
  );
}
