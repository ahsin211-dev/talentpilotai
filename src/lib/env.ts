import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AWS_REGION: optionalString,
  AWS_S3_BUCKET: optionalString,
  AWS_KMS_KEY_ID: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  WHATSAPP_WEBHOOK_SECRET: optionalString,
  GHL_API_KEY: optionalString,
  RECRUITMENT_CRM_WEBHOOK_URL: optionalString
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(requiredKeys: Array<keyof ServerEnv> = []) {
  const parsed = serverEnvSchema.parse(process.env);

  for (const key of requiredKeys) {
    if (!parsed[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return parsed;
}
