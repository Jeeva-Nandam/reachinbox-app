import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSenders, createSender } from "../api/senders.api";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";

export function useSenders() {
  return useQuery({ queryKey: ["senders"], queryFn: getSenders });
}

export function useCreateSender() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: createSender,
    onSuccess: () => {
      showToast("Sender added.", "success");
      queryClient.invalidateQueries({ queryKey: ["senders"] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Unable to add sender.";
      showToast(message, "error");
    },
  });
}
