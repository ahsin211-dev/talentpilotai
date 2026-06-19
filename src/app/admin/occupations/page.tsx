import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminOccupationsPage() {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  const { data: codes } = await supabase
    .from("occupation_codes")
    .select("id, code, title, skill_level, category, aliases, is_active")
    .order("code");

  return (
    <div>
      <PageHeader title="Occupation codes" subtitle="ANZSCO mapping table used by the AI classifier." />
      {codes && codes.length > 0 ? (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Code</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Skill level</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Aliases</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono">{c.code}</td>
                  <td className="py-2">{c.title}</td>
                  <td className="py-2">{c.skill_level ?? "—"}</td>
                  <td className="py-2">{c.category ?? "—"}</td>
                  <td className="py-2 text-slate-500">{(c.aliases ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No occupation codes seeded." />
      )}
    </div>
  );
}
