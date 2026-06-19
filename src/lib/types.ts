export type AppRole = "candidate" | "employer" | "admin";

export type ProfileStatus = "draft" | "pending_review" | "approved" | "rejected";

export type UnlockStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SubscriptionState =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled";
