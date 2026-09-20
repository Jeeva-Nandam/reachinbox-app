import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { searchEmails } from "../api/emails.api";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function useSearchEmails(rawQuery: string) {
  const query = useDebouncedValue(rawQuery.trim(), 350);

  return useQuery({
    queryKey: ["emails", "search", query],
    queryFn: () => searchEmails(query),
    enabled: query.length > 0,
  });
}
