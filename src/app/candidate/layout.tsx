import { TopNav } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TopNav
        title="TalentPilotAI"
        links={[
          { href: "/candidate", label: "Status" },
          { href: "/candidate/intake", label: "My details" },
          { href: "/candidate/documents", label: "Documents" },
          { href: "/candidate/requests", label: "Contact requests" },
        ]}
      />
      <main className="mx-auto max-w-4xl px-6 py-8">
        {children}
        <form action={signOut} className="mt-10">
          <button type="submit" className="text-sm text-slate-400 hover:text-slate-600">Sign out</button>
        </form>
      </main>
    </div>
  );
}
