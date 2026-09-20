import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSlackStatus, connectSlack, disconnectSlack } from "../api/slack.api";
import { useToast } from "../context/ToastContext";
import { ApiError } from "../api/client";

export function useSlackStatus() {
  return useQuery({ queryKey: ["slack", "status"], queryFn: getSlackStatus });
}

export function useConnectSlack() {
  const { showToast } = useToast();
  return useMutation({
    mutationFn: connectSlack, // navigates the browser away — see api/slack.api.ts
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Unable to start Slack connection.";
      showToast(message, "error");
    },
  });
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: disconnectSlack,
    onSuccess: () => {
      showToast("Slack disconnected.", "success");
      queryClient.invalidateQueries({ queryKey: ["slack", "status"] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : "Unable to disconnect Slack.";
      showToast(message, "error");
    },
  });
}
