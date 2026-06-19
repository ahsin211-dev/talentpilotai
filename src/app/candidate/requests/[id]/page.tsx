'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { respondToUnlockRequest } from '@/app/actions/candidate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function ContactRequestPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResponse(approved: boolean) {
    setLoading(true);
    await respondToUnlockRequest(params.id, approved);
    router.push('/candidate');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/candidate">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Contact Request</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Employer contact request</CardTitle>
            <p className="text-sm text-slate-500">
              An employer wants to contact you. If you approve, they will receive your surname,
              phone number, and email address.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => handleResponse(true)}
              disabled={loading}
            >
              Approve contact
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleResponse(false)}
              disabled={loading}
            >
              Decline
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
