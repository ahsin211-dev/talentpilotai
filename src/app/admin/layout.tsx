import { redirect } from "next/navigation";
import { TopNav } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import { resolveActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await resolveActor();
  if (actor.type !== "admin") redirect("/login");

  return (
    <div>
      <TopNav
        title="TalentPilotAI · Admin"
        links={[
          { href: "/admin", label: "Review queue" },
          { href: "/admin/cases", label: "Cases" },
          { href: "/admin/jobs", label: "Jobs" },
          { href: "/admin/occupations", label: "Occupations" },
          { href: "/admin/audit", label: "Audit logs" },
        ]}
      />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="mb-4 text-xs text-slate-400">Signed in as {actor.adminRole}</p>
        {children}
        <form action={signOut} className="mt-10">
          <button type="submit" className="text-sm text-slate-400 hover:text-slate-600">Sign out</button>
        </form>
      </main>
    </div>
  );
}
