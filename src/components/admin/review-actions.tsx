"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReviewActions({
  type,
  resourceId,
}: {
  type: "document" | "profile";
  resourceId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleReview(action: "approve" | "reject") {
    setLoading(action);
    await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, action, documentId: resourceId, profileId: resourceId }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="mt-3 flex gap-2">
      <Button size="sm" loading={loading === "approve"} onClick={() => handleReview("approve")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" loading={loading === "reject"} onClick={() => handleReview("reject")}>
        Reject
      </Button>
    </div>
  );
}
