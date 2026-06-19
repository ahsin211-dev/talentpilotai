import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * WhatsApp Business webhook (Phase 2). Meta sends a GET verification challenge
 * and POSTs delivery/status events. Events are persisted for processing with
 * idempotency; full message routing is built out in Phase 2.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_BUSINESS_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = createSupabaseAdminClient();
  const externalId = body?.entry?.[0]?.id ?? crypto.randomUUID();
  await admin
    .from("webhooks")
    .insert({
      provider: "whatsapp",
      direction: "inbound",
      event_type: "message",
      external_id: String(externalId),
      payload: body,
      status: "received",
    })
    .then(() => undefined, () => undefined); // ignore duplicates
  return NextResponse.json({ received: true });
}
