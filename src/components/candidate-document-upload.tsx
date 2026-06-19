"use client";

import { type FormEvent, useState } from "react";

type UploadState = {
  pending: boolean;
  message?: string;
  error?: string;
};

const readFileChecksum = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const CandidateDocumentUpload = () => {
  const [state, setState] = useState<UploadState>({ pending: false });

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("document") as File | null;
    const documentType = String(formData.get("documentType") ?? "");

    if (!file || !documentType) {
      setState({ pending: false, error: "Choose a document type and file." });
      return;
    }

    setState({ pending: true });

    try {
      const checksumSha256 = await readFileChecksum(file);
      const request = await fetch("/api/candidate/documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          documentType,
          originalFilename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          checksumSha256,
        }),
      });

      const requestPayload = (await request.json()) as {
        error?: string;
        uploadUrl?: string;
        uploadHeaders?: Record<string, string>;
      };

      if (!request.ok || !requestPayload.uploadUrl) {
        setState({
          pending: false,
          error: requestPayload.error ?? "Unable to start secure upload.",
        });
        return;
      }

      const uploadResponse = await fetch(requestPayload.uploadUrl, {
        method: "PUT",
        headers: requestPayload.uploadHeaders,
        body: file,
      });

      if (!uploadResponse.ok) {
        setState({ pending: false, error: "Secure file upload failed." });
        return;
      }

      setState({
        pending: false,
        message: "Uploaded successfully. Document is now queued for secure review.",
      });
    } catch {
      setState({ pending: false, error: "Unexpected upload error." });
    }
  };

  return (
    <form
      onSubmit={(event) => void submitDocument(event)}
      className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
        Document type
      </label>
      <select
        name="documentType"
        required
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="cv">CV</option>
        <option value="passport">Passport</option>
        <option value="id_document">ID document</option>
        <option value="qualification">Qualification</option>
        <option value="certificate">Certificate</option>
        <option value="other">Other</option>
      </select>
      <input
        name="document"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        required
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <button
        disabled={state.pending}
        type="submit"
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {state.pending ? "Uploading..." : "Upload securely"}
      </button>
      {state.message ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
};
