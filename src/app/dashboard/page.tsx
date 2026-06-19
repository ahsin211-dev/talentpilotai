import { redirect } from "next/navigation";
import { resolveActor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardRouter() {
  const actor = await resolveActor();
  switch (actor.type) {
    case "candidate":
      return redirect("/candidate");
    case "employer":
      return redirect("/employer");
    case "admin":
      return redirect("/admin");
    default:
      return redirect("/login");
  }
}
