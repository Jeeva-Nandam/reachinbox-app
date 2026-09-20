import { Button } from "../ui/Button";

interface EmailEmptyStateProps {
  title: string;
  description: string;
  showComposeButton?: boolean;
  onCompose?: () => void;
}

export function EmailEmptyState({ title, description, showComposeButton, onCompose }: EmailEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h16v12H4z M4 6l8 7 8-7"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-gray-400"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-gray-500">{description}</p>
      {showComposeButton && onCompose && (
        <Button className="mt-4" onClick={onCompose}>
          Compose New Email
        </Button>
      )}
    </div>
  );
}

export function EmailErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
