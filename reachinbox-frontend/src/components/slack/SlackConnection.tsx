import { useSlackStatus, useConnectSlack, useDisconnectSlack } from "../../hooks/useSlack";
import { Button } from "../ui/Button";
import { SkeletonCard } from "../ui/Spinner";
import { formatDateTime } from "../../utils/format";

export function SlackConnection() {
  const { data, isLoading } = useSlackStatus();
  const connectMutation = useConnectSlack();
  const disconnectMutation = useDisconnectSlack();

  if (isLoading) return <SkeletonCard />;

  return (
    <div className="max-w-md rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Slack</p>
          {data?.connected ? (
            <p className="mt-0.5 text-sm text-brand-600">
              Connected{data.teamName ? ` to ${data.teamName}` : ""} ✓
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">Not connected</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
      </div>

      {data?.connected && data.connectedAt && (
        <p className="mt-2 text-xs text-gray-400">Connected on {formatDateTime(data.connectedAt)}</p>
      )}

      <p className="mt-3 text-xs text-gray-500">
        When connected, you'll get a Slack notification if a sender hits its hourly sending limit. Email scheduling
        keeps working normally either way.
      </p>

      <div className="mt-4">
        {data?.connected ? (
          <Button variant="secondary" isLoading={disconnectMutation.isPending} onClick={() => disconnectMutation.mutate()}>
            Disconnect
          </Button>
        ) : (
          <Button isLoading={connectMutation.isPending} onClick={() => connectMutation.mutate()}>
            Connect Slack
          </Button>
        )}
      </div>
    </div>
  );
}
