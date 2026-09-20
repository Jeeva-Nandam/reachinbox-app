import { SlackConnection } from "../components/slack/SlackConnection";

export function SlackPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Connect Slack</h1>
      <SlackConnection />
    </div>
  );
}
