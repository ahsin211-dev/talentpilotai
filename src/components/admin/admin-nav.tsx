import Link from "next/link";

export function AdminNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-lg font-bold text-slate-900">
            TalentPilot Admin
          </Link>
          <nav className="flex gap-4">
            <Link href="/admin" className="text-sm text-slate-600 hover:text-slate-900">
              Review Queue
            </Link>
            <Link href="/admin/occupations" className="text-sm text-slate-600 hover:text-slate-900">
              Occupations
            </Link>
            <Link href="/admin/jobs" className="text-sm text-slate-600 hover:text-slate-900">
              Jobs
            </Link>
          </nav>
        </div>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          Admin
        </span>
      </div>
    </header>
  );
}
