import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/lib/env";
import { redactSensitiveText } from "@/lib/security/redaction";

export async function extractRedactedProfileFromDocument(ocrText: string) {
  const env = getServerEnv(["ANTHROPIC_API_KEY"]);
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const prompt = `
You are assisting a regulated Australian migration recruitment platform.
Extract structured candidate data, rewrite the profile for the Australian market,
and remove direct identifiers such as surname, phone, email, address, passport
numbers, or other contact details.

Return JSON with keys:
- headline
- summaryRedacted
- skills
- occupationTitle
- confidenceScore
`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system:
      "Never include unredacted personal identifiers in the output. Return JSON only.",
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nOCR text:\n${ocrText}`
      }
    ]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return redactSensitiveText(textBlock?.text ?? "");
}
