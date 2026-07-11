import "server-only";

import type { Category, Session } from "@/lib/storage";
import {
  listPastEventsPage,
  type DayEvent,
} from "@/lib/db/calendar-events";
import {
  listSessionHistory,
  SESSION_HISTORY_PAGE_SIZE,
} from "@/lib/db/sessions";

// One row of the /sessions history feed: either a clocked timer session or a
// synced Google Calendar event. The two live in separate tables, so the feed
// merges a page from each by start time.
export type HistoryItem =
  | { kind: "session"; session: Session }
  | { kind: "event"; event: DayEvent };

export function historyItemStartMs(item: HistoryItem): number {
  return item.kind === "session" ? item.session.startedAt : item.event.startMs;
}

// One page of merged history, newest first. Both sources are fetched with the
// same cursor and page size, merged, and trimmed to `limit` — dropped overflow
// rows reappear on the next page because the cursor is the oldest returned
// startMs. Category filter semantics match listSessionHistory:
// null = all, "none" = Uncategorized, else a category id.
export async function listHistoryPage(opts: {
  categoryId?: string | "none" | null;
  beforeMs?: number | null;
  limit?: number;
  categories: Category[];
}): Promise<HistoryItem[]> {
  const limit = opts.limit ?? SESSION_HISTORY_PAGE_SIZE;

  const [sessions, events] = await Promise.all([
    listSessionHistory({
      categoryId: opts.categoryId,
      beforeMs: opts.beforeMs,
      limit,
    }),
    listPastEventsPage({
      categoryId: opts.categoryId,
      beforeMs: opts.beforeMs,
      limit,
      categories: opts.categories,
    }),
  ]);

  const items: HistoryItem[] = [
    ...sessions.map((s) => ({ kind: "session" as const, session: s })),
    ...events.map((e) => ({ kind: "event" as const, event: e })),
  ];
  items.sort((a, b) => historyItemStartMs(b) - historyItemStartMs(a));
  return items.slice(0, limit);
}
