/**
 * Centralised, validated environment access.
 *
 * SECURITY: anything read here that is NOT prefixed with NEXT_PUBLIC_ must only
 * ever be imported from server-side code (server components, route handlers,
 * server actions, scripts). `assertServer()` guards the most dangerous values.
 */
import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(value: string | undefined, fallback = ""): string {
  return value ?? fallback;
}

export const publicEnv = {
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"),
  supabaseUrl: optional(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  stripePublishableKey: optional(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
};

export const serverEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get databaseUrl() {
    return required("DATABASE_URL", process.env.DATABASE_URL);
  },
  aws: {
    region: optional(process.env.AWS_REGION, "ap-southeast-2"),
    accessKeyId: optional(process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: optional(process.env.AWS_SECRET_ACCESS_KEY),
    documentsBucket: optional(process.env.S3_DOCUMENTS_BUCKET),
    kmsKeyId: optional(process.env.S3_KMS_KEY_ID),
    signedUrlTtl: Number(optional(process.env.S3_SIGNED_URL_TTL, "300")),
  },
  anthropic: {
    apiKey: optional(process.env.ANTHROPIC_API_KEY),
    model: optional(process.env.ANTHROPIC_MODEL, "claude-3-5-sonnet-latest"),
  },
  upstash: {
    url: optional(process.env.UPSTASH_REDIS_REST_URL),
    token: optional(process.env.UPSTASH_REDIS_REST_TOKEN),
  },
  stripe: {
    secretKey: optional(process.env.STRIPE_SECRET_KEY),
    webhookSecret: optional(process.env.STRIPE_WEBHOOK_SECRET),
    priceIdStandard: optional(process.env.STRIPE_PRICE_ID_STANDARD),
  },
  integrations: {
    whatsappToken: optional(process.env.WHATSAPP_BUSINESS_TOKEN),
    whatsappPhoneNumberId: optional(process.env.WHATSAPP_PHONE_NUMBER_ID),
    goHighLevelApiKey: optional(process.env.GOHIGHLEVEL_API_KEY),
    crmApiKey: optional(process.env.RECRUITMENT_CRM_API_KEY),
    esignatureApiKey: optional(process.env.ESIGNATURE_API_KEY),
  },
  internalWorkerSecret: optional(process.env.INTERNAL_WORKER_SECRET, "change-me-in-production"),
};

export function isConfigured(...values: Array<string | number | undefined>): boolean {
  return values.every((v) => v !== undefined && v !== "" && v !== 0);
}
