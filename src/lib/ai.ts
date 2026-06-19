import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/lib/env";

let anthropic: Anthropic | undefined;

function getAnthropicClient() {
  anthropic ??= new Anthropic({
    apiKey: getServerEnv().ANTHROPIC_API_KEY
  });

  return anthropic;
}

export async function classifyAndRedactCandidateDocument(input: {
  ocrText: string;
  occupationCodes: Array<{ code: string; title: string }>;
}) {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4000,
    temperature: 0,
    system:
      "Extract structured recruitment fields, rewrite profile content for the Australian market, map occupation codes, and redact all direct identifiers. Return JSON only. Never invent credentials.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task: "candidate_document_extraction_for_admin_review_only",
          piiToRedact: ["surname", "phone", "email", "address", "passport_number", "id_number", "direct_contact_details"],
          occupationCodes: input.occupationCodes,
          ocrText: input.ocrText
        })
      }
    ]
  });

  return message;
}
