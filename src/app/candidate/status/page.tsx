import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, StatusBadge } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function CandidateStatusPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*, case_stages(name, code, description)")
    .eq("user_id", user.id)
    .single();

  const { data: stages } = await supabase
    .from("case_stages")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  const currentOrder =
    stages?.find((s) => s.id === candidate?.case_stage_id)?.sort_order ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/candidate" className="text-sm text-blue-600 hover:underline">
          &larr; Back
        </Link>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Application Status</h1>

        <Card className="mt-6">
          <div className="space-y-4">
            {stages?.map((stage) => {
              const isComplete = stage.sort_order < currentOrder;
              const isCurrent = stage.id === candidate?.case_stage_id;

              return (
                <div key={stage.id} className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isComplete
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-blue-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isComplete ? "✓" : stage.sort_order}
                  </div>
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        isCurrent ? "text-blue-600" : "text-slate-900"
                      }`}
                    >
                      {stage.name}
                    </p>
                    {stage.description && (
                      <p className="text-xs text-slate-500">{stage.description}</p>
                    )}
                    {isCurrent && (
                      <StatusBadge status="processing" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {candidate?.consent_given_at && (
          <p className="mt-4 text-xs text-slate-500">
            Consent given on {formatDate(candidate.consent_given_at)} (v
            {candidate.consent_version})
          </p>
        )}
      </div>
    </div>
  );
}
