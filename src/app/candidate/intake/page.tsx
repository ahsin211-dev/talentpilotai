import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { IntakeForm } from "@/components/candidate-forms";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const actor = await requireActor("candidate");
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("candidate_private_details")
    .select("first_name, last_name, email, phone, country, nationality")
    .eq("candidate_id", actor.candidateId!)
    .maybeSingle();

  return (
    <div>
      <PageHeader
        title="My details"
        subtitle="These details are stored privately and never shown to employers without your consent."
      />
      <div className="card">
        <IntakeForm
          defaults={{
            firstName: data?.first_name ?? null,
            lastName: data?.last_name ?? null,
            email: data?.email ?? null,
            phone: data?.phone ?? null,
            country: data?.country ?? null,
            nationality: data?.nationality ?? null,
          }}
        />
      </div>
    </div>
  );
}
