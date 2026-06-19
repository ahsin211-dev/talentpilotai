import Link from 'next/link';
import { DocumentUploader } from '@/components/candidate/document-uploader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CandidateDocumentsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/candidate">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-bold text-lg">Upload Documents</h1>
            <p className="text-xs text-slate-500">Securely encrypted storage</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-12">
        <p className="text-sm text-slate-600">
          Upload your documents for AI processing. All files are encrypted and reviewed by our team
          before any information is shared with employers.
        </p>

        <DocumentUploader documentType="cv" label="CV / Resume" />
        <DocumentUploader documentType="passport" label="Passport" />
        <DocumentUploader documentType="id" label="Photo ID" />
        <DocumentUploader documentType="qualification" label="Qualifications / Certificates" />
        <DocumentUploader documentType="consent" label="Signed Consent Form" />
      </main>
    </div>
  );
}
