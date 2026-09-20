import { Email } from "../../types/email.types";
import { EmailStatusBadge } from "./EmailStatusBadge";
import { formatDateTime } from "../../utils/format";
import { Button } from "../ui/Button";

interface EmailTableProps {
  emails: Email[];
  dateField: "scheduledAt" | "sentAt";
  dateLabel: string;
  onCancel?: (id: string) => void;
  cancellingId?: string;
}

export function EmailTable({ emails, dateField, dateLabel, onCancel, cancellingId }: EmailTableProps) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">{dateLabel}</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {onCancel && <th className="px-4 py-3 font-medium" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50">
                <td className="max-w-[220px] truncate px-4 py-3 text-gray-900">{email.recipient}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-gray-600">{email.subject}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {formatDateTime(email[dateField])}
                </td>
                <td className="px-4 py-3">
                  <EmailStatusBadge status={email.status} />
                  {email.lastError && (
                    <p className="mt-1 max-w-[280px] text-xs text-red-600" title={email.lastError}>
                      {email.lastError}
                    </p>
                  )}
                  {email.previewUrl && (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                    >
                      View test email
                    </a>
                  )}
                </td>
                {onCancel && (
                  <td className="px-4 py-3 text-right">
                    {email.status === "scheduled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={cancellingId === email.id}
                        onClick={() => onCancel(email.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {emails.map((email) => (
          <div key={email.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium text-gray-900">{email.recipient}</p>
              <EmailStatusBadge status={email.status} />
            </div>
            {email.lastError && <p className="mt-1 text-xs text-red-600">{email.lastError}</p>}
            {email.previewUrl && (
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-brand-600 hover:underline"
              >
                View test email
              </a>
            )}
            <p className="mt-1 truncate text-sm text-gray-600">{email.subject}</p>
            <p className="mt-2 text-xs text-gray-400">
              {dateLabel}: {formatDateTime(email[dateField])}
            </p>
            {onCancel && email.status === "scheduled" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 -ml-3"
                isLoading={cancellingId === email.id}
                onClick={() => onCancel(email.id)}
              >
                Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
