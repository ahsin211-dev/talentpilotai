'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function EmployerBillingPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/employer">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">Billing</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Employer Subscription</CardTitle>
            <p className="text-sm text-slate-500">
              Subscribe to browse redacted candidate profiles, save favourites, and request contact access.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
              <p className="text-2xl font-bold text-slate-900">$299 <span className="text-sm font-normal text-slate-500">/ month</span></p>
              <ul className="mt-3 text-sm text-slate-600 space-y-1">
                <li>• Browse admin-approved redacted profiles</li>
                <li>• Search by occupation, skills, and experience</li>
                <li>• Save favourites</li>
                <li>• Request candidate contact (with consent)</li>
              </ul>
            </div>
            <Button onClick={handleSubscribe} disabled={loading} className="w-full">
              {loading ? 'Redirecting to Stripe...' : 'Subscribe with Stripe'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
