import { useState } from "react";
import { useSearchEmails } from "../../hooks/useSearchEmails";
import { EmailStatusBadge } from "./EmailStatusBadge";
import { formatDateTime } from "../../utils/format";
import { SkeletonCard } from "../ui/Spinner";
import { ApiError } from "../../api/client";

export function EmailSearch() {
  const [input, setInput] = useState("");
  const { data, isLoading, isFetching, isError, error } = useSearchEmails(input);

  return (
    <div>
      <div className="relative mb-4">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search emails by recipient, subject, or body…"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {input.trim().length === 0 && <p className="text-sm text-gray-400">Start typing to search your emails.</p>}

      {input.trim().length > 0 && (isLoading || isFetching) && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600">
          {error instanceof ApiError ? error.message : "Search is temporarily unavailable."}
        </p>
      )}

      {!isLoading && !isFetching && !isError && data && data.results.length === 0 && input.trim().length > 0 && (
        <p className="text-sm text-gray-500">No emails matched "{input.trim()}".</p>
      )}

      {!isLoading && data && data.results.length > 0 && (
        <ul className="space-y-2">
          {data.results.map((hit) => (
            <li key={hit.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-gray-900">{hit.recipient}</p>
                <EmailStatusBadge status={hit.status} />
              </div>
              <p className="mt-1 truncate text-sm text-gray-600">{hit.subject}</p>
              <p className="mt-1 text-xs text-gray-400">
                Scheduled: {formatDateTime(hit.scheduledAt)}
                {hit.sentAt ? ` · Sent: ${formatDateTime(hit.sentAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
