import { EmailSearch } from "../components/emails/EmailSearch";

export function SearchPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Search Emails</h1>
      <EmailSearch />
    </div>
  );
}
