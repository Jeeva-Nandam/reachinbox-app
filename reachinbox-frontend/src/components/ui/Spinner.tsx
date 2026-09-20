export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-brand-600"
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-3 w-40 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-48 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-28 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 rounded-full bg-gray-200" />
      </td>
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 p-4 space-y-2">
      <div className="h-3 w-1/2 rounded bg-gray-200" />
      <div className="h-3 w-2/3 rounded bg-gray-200" />
      <div className="h-3 w-1/3 rounded bg-gray-200" />
    </div>
  );
}
