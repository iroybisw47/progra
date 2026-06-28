import { listCategories } from "@/lib/db/categories";
import { listSessionHistory, SESSION_HISTORY_PAGE_SIZE } from "@/lib/db/sessions";

import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  const [categories, initialSessions] = await Promise.all([
    listCategories(),
    listSessionHistory({ limit: SESSION_HISTORY_PAGE_SIZE }),
  ]);

  return (
    <SessionsClient
      categories={categories}
      initialSessions={initialSessions}
      pageSize={SESSION_HISTORY_PAGE_SIZE}
    />
  );
}
