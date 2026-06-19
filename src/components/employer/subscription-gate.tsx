"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function SubscriptionGate() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    const res = await fetch("/api/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkout" }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.url) window.location.href = data.url;
  }

  return (
    <Card className="mx-auto max-w-lg text-center" title="Subscription required">
      <p className="text-sm text-slate-600">
        Browse redacted candidate profiles and request contact access with an active
        employer subscription.
      </p>
      <Button className="mt-4" onClick={startCheckout} loading={loading}>
        Start subscription
      </Button>
    </Card>
  );
}
