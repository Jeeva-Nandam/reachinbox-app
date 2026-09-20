import { useOutletContext } from "react-router-dom";
import { useScheduledEmails, useCancelEmail } from "../hooks/useEmails";
import { EmailTable } from "../components/emails/EmailTable";
import { EmailEmptyState, EmailErrorState } from "../components/emails/EmailEmptyState";
import { SkeletonRow } from "../components/ui/Spinner";
import { Pagination } from "../components/ui/Pagination";
import { ApiError } from "../api/client";
import { DashboardOutletContext } from "../components/layout/DashboardLayout";

export function ScheduledEmailsPage() {
  const { openCompose } = useOutletContext<DashboardOutletContext>();
  const { data, isLoading, isError, error, refetch, page, setPage } = useScheduledEmails();
  const cancelMutation = useCancelEmail();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Scheduled Emails</h1>
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
        <EmailEmptyState
          title="No scheduled emails yet."
          description="Schedule your first email to see it here."
          showComposeButton
          onCompose={openCompose}
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <EmailTable
            emails={data.items}
            dateField="scheduledAt"
            dateLabel="Scheduled Time"
            onCancel={(id) => cancelMutation.mutate(id)}
            cancellingId={cancelMutation.isPending ? cancelMutation.variables : undefined}
          />
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
