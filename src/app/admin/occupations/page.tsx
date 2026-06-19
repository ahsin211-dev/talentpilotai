import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminOccupationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: occupations } = await supabase
    .from("occupation_codes")
    .select("*")
    .order("code");

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Occupation Codes</h1>
        <Card className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">Code</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Skill Level</th>
                <th className="pb-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {occupations?.map((oc) => (
                <tr key={oc.id} className="border-b border-slate-100">
                  <td className="py-2 font-mono">{oc.code}</td>
                  <td className="py-2">{oc.title}</td>
                  <td className="py-2">{oc.skill_level ?? "—"}</td>
                  <td className="py-2">{oc.is_active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}
