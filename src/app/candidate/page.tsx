import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, StatusBadge } from "@/components/ui/card";
import { FileText, Upload, Bell, LogOut } from "lucide-react";
import { ContactApprovalButtons } from "@/components/candidate/contact-approval-buttons";

export default async function CandidateDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*, case_stages(name, code)")
    .eq("user_id", user.id)
    .single();

  const { data: profile } = await supabase
    .from("candidate_profiles_public_redacted")
    .select("*")
    .eq("candidate_id", candidate?.id ?? "")
    .maybeSingle();

  const { data: documents } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("candidate_id", candidate?.id ?? "")
    .order("uploaded_at", { ascending: false });

  const { data: unlockRequests } = await supabase
    .from("contact_unlock_requests")
    .select("*, employer_accounts(company_name)")
    .eq("candidate_id", candidate?.id ?? "")
    .eq("status", "candidate_pending");

  const needsOnboarding = !candidate?.consent_given_at;

  if (needsOnboarding) {
    redirect("/candidate/onboarding");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">My Application</h1>
          <form action="/api/auth/login" method="DELETE">
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 pb-24">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Case status</p>
              <p className="font-semibold text-slate-900">
                {(candidate?.case_stages as { name?: string })?.name ?? "In progress"}
              </p>
            </div>
            {profile && <StatusBadge status={profile.status} />}
          </div>
        </Card>

        {unlockRequests && unlockRequests.length > 0 && (
          <Card title="Contact requests" description="Employers requesting your contact details">
            <div className="space-y-3">
              {unlockRequests.map((req) => (
                <ContactRequestCard key={req.id} request={req} />
              ))}
            </div>
          </Card>
        )}

        <Card title="Documents" description="Upload your CV, ID, and qualifications">
          <div className="space-y-2">
            {documents?.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {doc.document_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-500">{doc.file_name}</p>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </div>
            ))}
          </div>
          <Link href="/candidate/upload" className="mt-4 block">
            <Button className="w-full" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload document
            </Button>
          </Link>
        </Card>

        <Card title="Notifications">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Bell className="h-5 w-5 text-slate-400" />
            <p>You&apos;ll receive updates via email and WhatsApp when your application progresses.</p>
          </div>
        </Card>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg justify-around">
          <Link href="/candidate" className="text-sm font-medium text-blue-600">
            Home
          </Link>
          <Link href="/candidate/upload" className="text-sm text-slate-600">
            Upload
          </Link>
          <Link href="/candidate/status" className="text-sm text-slate-600">
            Status
          </Link>
        </div>
      </nav>
    </div>
  );
}

function ContactRequestCard({
  request,
}: {
  request: {
    id: string;
    message: string | null;
    employer_accounts: { company_name: string } | null;
  };
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-slate-900">
        {request.employer_accounts?.company_name ?? "An employer"} wants to contact you
      </p>
      {request.message && (
        <p className="mt-1 text-xs text-slate-600">&ldquo;{request.message}&rdquo;</p>
      )}
      <ContactApprovalButtons requestId={request.id} />
    </div>
  );
}
