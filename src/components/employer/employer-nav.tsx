import Link from "next/link";

export function EmployerNav({ companyName }: { companyName: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/employer" className="text-lg font-bold text-slate-900">
            TalentPilot
          </Link>
          <nav className="hidden gap-4 sm:flex">
            <Link href="/employer" className="text-sm text-slate-600 hover:text-slate-900">
              Browse
            </Link>
            <Link href="/employer/favourites" className="text-sm text-slate-600 hover:text-slate-900">
              Favourites
            </Link>
            <Link href="/employer/subscription" className="text-sm text-slate-600 hover:text-slate-900">
              Subscription
            </Link>
          </nav>
        </div>
        <span className="text-sm text-slate-500">{companyName}</span>
      </div>
    </header>
  );
}
