import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminReviewQueue() {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  const { data: queue } = await supabase
    .from("ai_extraction_results")
    .select("id, candidate_id, confidence_score, review_status, created_at")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle="AI extraction results awaiting human approval. Nothing is published to employers without your review."
      />
      {queue && queue.length > 0 ? (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Candidate</th>
                <th className="pb-2">Confidence</th>
                <th className="pb-2">Received</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{r.candidate_id.slice(0, 8)}…</td>
                  <td className="py-2">
                    <span className={`badge ${(r.confidence_score ?? 0) >= 0.6 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                      {Math.round((r.confidence_score ?? 0) * 100)}%
                    </span>
                  </td>
                  <td className="py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/review/${r.id}`} className="btn-primary">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="The review queue is empty." />
      )}
    </div>
  );
}
