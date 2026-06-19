import type { PortalMetric } from "@/lib/domain";

export const candidateMetrics: PortalMetric[] = [
  { label: "Profile completion", value: "68%", hint: "Consent captured, documents pending review" },
  { label: "Case stage", value: "Initial review", hint: "Migration team validation in progress" },
  { label: "Notifications", value: "2 pending", hint: "WhatsApp and email reminders queued" }
];

export const employerMetrics: PortalMetric[] = [
  { label: "Approved candidates", value: "146", hint: "Only admin-approved redacted profiles are visible" },
  { label: "Saved profiles", value: "12", hint: "Subscription-gated shortlist" },
  { label: "Unlock requests", value: "3 pending", hint: "Contact details hidden until candidate approval" }
];

export const adminMetrics: PortalMetric[] = [
  { label: "Review queue", value: "24", hint: "AI outputs awaiting human approval" },
  { label: "Failed jobs", value: "2", hint: "Textract retry policy will requeue with backoff" },
  { label: "Audit events", value: "1,284", hint: "Sensitive access and state changes are logged" }
];

export const sampleProfiles = [
  {
    id: "2f8b322f-1d8e-4b7a-bdc7-ec585c9de550",
    displayName: "Joseph M.",
    occupation: "Diesel Motor Mechanic",
    location: "Philippines",
    availability: "8 weeks",
    summary:
      "Trade-qualified mechanic with 9 years of heavy vehicle maintenance, workshop diagnostics, and fleet service leadership."
  },
  {
    id: "9ea37851-3db0-4f8d-8509-7e8898e8339a",
    displayName: "Fatima A.",
    occupation: "Chef",
    location: "UAE",
    availability: "Immediate",
    summary:
      "Commercial kitchen leader experienced in menu compliance, HACCP, and training multicultural hospitality teams."
  }
];
