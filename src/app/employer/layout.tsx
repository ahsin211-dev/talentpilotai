import { TopNav } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TopNav
        title="TalentPilotAI"
        links={[
          { href: "/employer", label: "Browse" },
          { href: "/employer/favourites", label: "Favourites" },
          { href: "/employer/requests", label: "Requests" },
          { href: "/employer/billing", label: "Billing" },
        ]}
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
        <form action={signOut} className="mt-10">
          <button type="submit" className="text-sm text-slate-400 hover:text-slate-600">Sign out</button>
        </form>
      </main>
    </div>
  );
}
