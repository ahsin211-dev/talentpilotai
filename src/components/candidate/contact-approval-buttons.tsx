"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ContactApprovalButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    await fetch("/api/candidate/contact-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="mt-3 flex gap-2">
      <Button
        size="sm"
        loading={loading === "approve"}
        onClick={() => handleAction("approve")}
      >
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={loading === "reject"}
        onClick={() => handleAction("reject")}
      >
        Decline
      </Button>
    </div>
  );
}
