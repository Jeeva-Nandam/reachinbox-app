import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getScheduledEmails, getSentEmails, cancelEmail } from "../api/emails.api";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";

export function useScheduledEmails(limit = 20) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["emails", "scheduled", page, limit],
    queryFn: () => getScheduledEmails(page, limit),
    // Scheduled emails move through states as jobs fire — poll gently rather than
    // making the user manually refresh (spec §31: avoid aggressive polling).
    refetchInterval: 15000,
  });
  return { ...query, page, setPage };
}

export function useSentEmails(limit = 20) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["emails", "sent", page, limit],
    queryFn: () => getSentEmails(page, limit),
  });
  return { ...query, page, setPage };
}

export function useCancelEmail() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => cancelEmail(id),
    onSuccess: () => {
      showToast("Scheduled email cancelled.", "success");
      queryClient.invalidateQueries({ queryKey: ["emails", "scheduled"] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Unable to cancel this email.";
      showToast(message, "error");
    },
  });
}
