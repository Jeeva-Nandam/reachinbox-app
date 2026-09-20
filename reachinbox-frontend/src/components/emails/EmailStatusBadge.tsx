import { EmailStatus } from "../../types/email.types";

const STYLES: Record<EmailStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-brand-50 text-brand-700 border-brand-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  rate_limited: "bg-purple-50 text-purple-700 border-purple-200",
};

const LABELS: Record<EmailStatus, string> = {
  scheduled: "Scheduled",
  processing: "Processing",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
  rate_limited: "Rate limited",
};

export function EmailStatusBadge({ status }: { status: EmailStatus | string }) {
  const key = (status in STYLES ? status : "scheduled") as EmailStatus;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[key]}`}
    >
      {LABELS[key] ?? status}
    </span>
  );
}
