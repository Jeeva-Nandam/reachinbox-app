import { useSentEmails } from "../hooks/useEmails";
import { EmailTable } from "../components/emails/EmailTable";
import { EmailEmptyState, EmailErrorState } from "../components/emails/EmailEmptyState";
import { SkeletonRow } from "../components/ui/Spinner";
import { Pagination } from "../components/ui/Pagination";
import { ApiError } from "../api/client";

export function SentEmailsPage() {
  const { data, isLoading, isError, error, refetch, page, setPage } = useSentEmails();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Sent Emails</h1>
      </div>

      {isLoading && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isError && (
        <EmailErrorState
          message={error instanceof ApiError ? error.message : "Unable to load emails."}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmailEmptyState title="No sent emails yet." description="Emails will show up here once they've been sent." />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <EmailTable emails={data.items} dateField="sentAt" dateLabel="Sent Time" />
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
