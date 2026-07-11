import { listCategories } from "@/lib/db/categories";
import { listHistoryPage } from "@/lib/db/history";
import { SESSION_HISTORY_PAGE_SIZE } from "@/lib/db/sessions";

import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  // Categories first: event categorization (rules/overrides) needs them.
  const categories = await listCategories();
  const initialItems = await listHistoryPage({
    limit: SESSION_HISTORY_PAGE_SIZE,
    categories,
  });

  return (
    <SessionsClient
      categories={categories}
      initialItems={initialItems}
      pageSize={SESSION_HISTORY_PAGE_SIZE}
    />
  );
}
