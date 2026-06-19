import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";

export const runCandidateDocumentExtraction = async ({
  ocrText,
  documentType,
}: {
  ocrText: string;
  documentType: string;
}) => {
  const env = getServerEnv();
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-0",
    max_tokens: 3000,
    temperature: 0,
    system:
      "You extract structured recruitment profile fields and redact PII. Return strict JSON only.",
    messages: [
      {
        role: "user",
        content: `Document type: ${documentType}\n\nOCR content:\n${ocrText}`,
      },
    ],
  });

  return response;
};
