"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatFileSize } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "cv", label: "CV / Resume" },
  { value: "passport", label: "Passport" },
  { value: "id", label: "ID Document" },
  { value: "qualification", label: "Qualification / Certificate" },
] as const;

export default function CandidateUploadPage() {
  const router = useRouter();
  const [documentType, setDocumentType] = useState<string>("cv");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setLoading(false);
        return;
      }

      const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        setError("Failed to upload file to storage");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setFile(null);
      setTimeout(() => router.push("/candidate"), 1500);
    } catch {
      setError("Upload failed. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-bold text-slate-900">Upload Document</h1>

        <Card>
          {success ? (
            <p className="text-center text-green-600">
              Document uploaded successfully! Redirecting...
            </p>
          ) : (
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Document type
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  File (PDF, JPG, PNG, DOC — max 10 MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                  required
                />
                {file && (
                  <p className="mt-1 text-xs text-slate-500">
                    {file.name} — {formatFileSize(file.size)}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button type="submit" className="w-full" loading={loading} disabled={!file}>
                Upload securely
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
