export interface SlackOAuthExchangeResponse {
  ok: boolean;
  access_token?: string;
  team?: { id: string; name: string };
  error?: string;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  connectedAt?: string;
}
