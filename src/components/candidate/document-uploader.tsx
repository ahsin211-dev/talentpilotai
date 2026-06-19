'use client';

import { useState } from 'react';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/validation/schemas';
import { Upload, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DocumentUploaderProps {
  documentType: 'cv' | 'passport' | 'id' | 'qualification' | 'consent' | 'other';
  label: string;
  onComplete?: () => void;
}

export function DocumentUploader({ documentType, label, onComplete }: DocumentUploaderProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      setError('Only PDF, JPEG, PNG, and WebP files are allowed');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File must be under 10MB');
      return;
    }

    setError(null);
    setStatus('uploading');

    try {
      const initRes = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.error ?? 'Upload failed');
      }

      const { uploadUrl, documentId } = await initRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('S3 upload failed');

      setStatus('processing');
      await fetch('/api/documents/upload', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      setStatus('done');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-teal-100 p-2">
          {status === 'done' ? (
            <CheckCircle className="h-5 w-5 text-teal-600" />
          ) : status === 'uploading' || status === 'processing' ? (
            <Loader2 className="h-5 w-5 text-teal-600 animate-spin" />
          ) : (
            <FileText className="h-5 w-5 text-teal-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900">{label}</p>
            {status === 'done' && <Badge variant="success">Uploaded</Badge>}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">PDF or image, max 10MB</p>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
        <label className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            disabled={status === 'uploading' || status === 'processing'}
          />
          <Upload className="h-4 w-4 mr-1.5" />
          Upload
        </label>
      </div>
    </div>
  );
}
