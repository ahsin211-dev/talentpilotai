"use client";

import { Card, StatusBadge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { EmployerNav } from "@/components/employer/employer-nav";
import { useEffect } from "react";

export default function EmployerSubscriptionPage() {
  const [subscription, setSubscription] = useState<{
    status: string;
    current_period_end: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    fetch("/api/employer/me")
      .then((r) => r.json())
      .then((data) => {
        setSubscription(data.subscription);
        setCompanyName(data.employer?.company_name ?? "");
      });
  }, []);

  async function handleAction(action: "checkout" | "portal") {
    setLoading(true);
    const res = await fetch("/api/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <EmployerNav companyName={companyName || "Employer"} />
      <main className="mx-auto max-w-lg px-4 py-8">
        <Card title="Subscription">
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Status</span>
                <StatusBadge status={subscription.status} />
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Renews</span>
                  <span className="text-sm font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString("en-AU")}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                loading={loading}
                onClick={() => handleAction("portal")}
              >
                Manage subscription
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-slate-600">No active subscription</p>
              <Button
                className="mt-4 w-full"
                loading={loading}
                onClick={() => handleAction("checkout")}
              >
                Subscribe now
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
