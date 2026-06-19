'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { submitCandidateIntake } from '@/app/actions/candidate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function CandidateIntakePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    formData.set('consentGiven', formData.get('consent') ? 'true' : 'false');

    const result = await submitCandidateIntake(formData);

    if (result.error) {
      setErrors(result.error as Record<string, string[]>);
      setLoading(false);
      return;
    }

    router.push('/candidate/documents');
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
          <h1 className="font-bold text-lg">Intake Form</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <p className="text-sm text-slate-500">
              Your surname and contact details are kept private until you approve employer contact.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="givenName">Given name *</Label>
                  <Input id="givenName" name="givenName" required />
                  {errors.givenName && <p className="text-xs text-red-600 mt-1">{errors.givenName[0]}</p>}
                </div>
                <div>
                  <Label htmlFor="surname">Surname *</Label>
                  <Input id="surname" name="surname" required />
                  {errors.surname && <p className="text-xs text-red-600 mt-1">{errors.surname[0]}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="preferredName">Preferred name</Label>
                <Input id="preferredName" name="preferredName" />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required />
              </div>

              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" type="tel" required />
              </div>

              <div>
                <Label htmlFor="countryOfOrigin">Country of origin *</Label>
                <Input id="countryOfOrigin" name="countryOfOrigin" required placeholder="e.g. Philippines" />
              </div>

              <div>
                <Label htmlFor="currentLocation">Current location</Label>
                <Input id="currentLocation" name="currentLocation" placeholder="City, Country" />
              </div>

              <div>
                <Label htmlFor="yearsExperience">Years of experience</Label>
                <Input id="yearsExperience" name="yearsExperience" type="number" min="0" max="50" />
              </div>

              <div>
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input id="skills" name="skills" placeholder="Bricklaying, Formwork, Reading plans" />
              </div>

              <div>
                <Label htmlFor="availabilityDate">Available from</Label>
                <Input id="availabilityDate" name="availabilityDate" type="date" />
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" name="consent" required className="mt-1" />
                  <span className="text-sm text-slate-700">
                    I consent to TalentPilot AI collecting and processing my personal information
                    for migration and recruitment purposes, including secure document storage and
                    sharing redacted profile information with potential employers. *
                  </span>
                </label>
                {errors.consentGiven && (
                  <p className="text-xs text-red-600 mt-2">{errors.consentGiven[0]}</p>
                )}
              </div>

              {errors._form && <p className="text-sm text-red-600">{errors._form[0]}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Continue to documents'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
