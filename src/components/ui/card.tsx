import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function Card({ children, className, title, description }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
      {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </div>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
    approved: "success",
    active: "success",
    published: "success",
    pending: "warning",
    pending_review: "warning",
    review_required: "warning",
    processing: "info",
    rejected: "danger",
    failed: "danger",
    canceled: "default",
    draft: "default",
  };
  return <Badge variant={map[status] ?? "default"}>{status.replace(/_/g, " ")}</Badge>;
}
