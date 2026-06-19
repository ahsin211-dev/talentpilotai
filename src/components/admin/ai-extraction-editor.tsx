'use client';

import { useState, useTransition } from 'react';
import { saveAiExtractionEdits, approveAiExtraction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { confidenceLabel } from '@/lib/ai/confidence';

interface AiExtractionEditorProps {
  extraction: {
    id: string;
    confidence_score: number | null;
    extracted_fields: Record<string, unknown> | null;
    redacted_fields: Record<string, unknown> | null;
    rewritten_cv: string | null;
    raw_ai_output: Record<string, unknown> | null;
    is_admin_approved: boolean;
    admin_edited_output: Record<string, unknown> | null;
    candidate_documents?: { document_type?: string; candidate_id?: string } | null;
  };
}

export function AiExtractionEditor({ extraction }: AiExtractionEditorProps) {
  const edited = extraction.admin_edited_output ?? {};
  const fields = extraction.extracted_fields ?? {};

  const [headline, setHeadline] = useState(
    (edited.headline as string) ?? (fields.job_title as string) ?? ''
  );
  const [summary, setSummary] = useState(
    (edited.summary as string) ?? extraction.rewritten_cv?.slice(0, 500) ?? ''
  );
  const [skills, setSkills] = useState(
    ((edited.skills as string[]) ?? (fields.skills as string[]) ?? []).join(', ')
  );
  const [occupationTitle, setOccupationTitle] = useState(
    (edited.occupation_title as string) ?? (fields.job_title as string) ?? ''
  );
  const [yearsExperience, setYearsExperience] = useState(
    String((edited.years_experience as number) ?? (fields.years_experience as number) ?? '')
  );

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const score = extraction.confidence_score ?? 0;
  const label = confidenceLabel(score);

  function handleSave() {
    startTransition(async () => {
      const result = await saveAiExtractionEdits({
        extractionId: extraction.id,
        headline,
        summary,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        occupationTitle,
        yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
      });
      setMessage(result.error ? String(result.error) : 'Saved — profile draft updated');
    });
  }

  function handleApprove() {
    startTransition(async () => {
      await saveAiExtractionEdits({
        extractionId: extraction.id,
        headline,
        summary,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        occupationTitle,
        yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
      });
      await approveAiExtraction(extraction.id);
      setMessage('AI extraction approved');
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={label === 'high' ? 'success' : label === 'medium' ? 'warning' : 'danger'}>
          Confidence: {score}% ({label})
        </Badge>
        {extraction.is_admin_approved && <Badge variant="success">Approved</Badge>}
        <span className="text-xs text-slate-500 capitalize">
          {extraction.candidate_documents?.document_type?.replace('_', ' ')}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-red-600 font-semibold">Private fields (never shown to employers)</Label>
          <pre className="text-xs bg-red-50 border border-red-100 p-3 rounded-lg overflow-auto max-h-48 mt-1">
            {JSON.stringify(extraction.extracted_fields, null, 2)}
          </pre>
        </div>
        <div>
          <Label className="text-xs text-emerald-600 font-semibold">Redacted fields (employer-safe draft)</Label>
          <pre className="text-xs bg-emerald-50 border border-emerald-100 p-3 rounded-lg overflow-auto max-h-48 mt-1">
            {JSON.stringify(extraction.redacted_fields, null, 2)}
          </pre>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`headline-${extraction.id}`}>Headline</Label>
          <Input id={`headline-${extraction.id}`} value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`occupation-${extraction.id}`}>Occupation title</Label>
          <Input id={`occupation-${extraction.id}`} value={occupationTitle} onChange={(e) => setOccupationTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`years-${extraction.id}`}>Years experience</Label>
          <Input id={`years-${extraction.id}`} type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`skills-${extraction.id}`}>Skills (comma-separated)</Label>
          <Input id={`skills-${extraction.id}`} value={skills} onChange={(e) => setSkills(e.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor={`summary-${extraction.id}`}>Summary / rewritten CV excerpt</Label>
        <textarea
          id={`summary-${extraction.id}`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[120px]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      {message && <p className="text-sm text-teal-600">{message}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={pending}>
          Save edits
        </Button>
        {!extraction.is_admin_approved && (
          <Button size="sm" variant="secondary" onClick={handleApprove} disabled={pending}>
            Approve extraction
          </Button>
        )}
      </div>
    </div>
  );
}
