import "server-only";

import { createClient } from "@/lib/supabase/server";
import { categorizeTitle } from "@/lib/categorize";
import type { Category } from "@/lib/storage";

export type DayEvent = {
  id: string;
  title: string | null;
  startMs: number;
  endMs: number;
  // null = uncategorized
  category: { id: string; name: string; color: string | null } | null;
  // "manual" = explicit override set by user; "rule" = matched a category rule;
  // "ai" = assigned by the auto-categorizer; "uncategorized" = none of the above.
  source: "manual" | "rule" | "ai" | "uncategorized";
};

type Row = {
  id: string;
  title: string | null;
  start_time: string;
  end_time: string;
};

type OverrideRow = {
  event_id: string;
  category_id: string;
  source: string | null;
};

type ExclusionRow = {
  event_id: string;
};

// Categorize raw event rows: drop excluded events, then resolve each event's
// category (manual override > keyword rule > AI guess > uncategorized).
// Shared by the range read below and the paginated history read.
function toDayEvents(
  eventRows: Row[],
  exclusions: ExclusionRow[],
  overrides: OverrideRow[],
  categories: Category[]
): DayEvent[] {
  const excludedIds = new Set(exclusions.map((r) => r.event_id));
  // Split stored categorizations by provenance. Manual overrides win over a
  // keyword rule; AI assignments sit below rules (a rule the user later adds
  // takes precedence over an earlier AI guess).
  const manualOverrides = new Map<string, string>();
  const aiOverrides = new Map<string, string>();
  for (const r of overrides) {
    if (r.source === "ai") aiOverrides.set(r.event_id, r.category_id);
    else manualOverrides.set(r.event_id, r.category_id);
  }

  const rows = eventRows.filter((r) => !excludedIds.has(r.id));
  if (rows.length === 0) return [];

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return rows.map((row) => {
    const manualCategoryId = manualOverrides.get(row.id);

    let category: DayEvent["category"];
    let source: DayEvent["source"];

    const manualCat = manualCategoryId
      ? categoryById.get(manualCategoryId)
      : undefined;
    const ruleMatch = categorizeTitle(row.title, categories);
    const aiCategoryId = aiOverrides.get(row.id);
    const aiCat = aiCategoryId ? categoryById.get(aiCategoryId) : undefined;

    if (manualCat) {
      category = { id: manualCat.id, name: manualCat.name, color: manualCat.color };
      source = "manual";
    } else if (ruleMatch) {
      category = {
        id: ruleMatch.id,
        name: ruleMatch.name,
        color: ruleMatch.color,
      };
      source = "rule";
    } else if (aiCat) {
      category = { id: aiCat.id, name: aiCat.name, color: aiCat.color };
      source = "ai";
    } else {
      category = null;
      source = "uncategorized";
    }

    return {
      id: row.id,
      title: row.title,
      startMs: new Date(row.start_time).getTime(),
      endMs: new Date(row.end_time).getTime(),
      category,
      source,
    };
  });
}

// Returns events overlapping [startMs, endMs), categorized. Manual overrides
// win over rule matches. Excluded events are filtered out entirely.
//
// All three Supabase queries fire in parallel — exclusions and overrides
// don't depend on the event-id list because RLS already scopes them to the
// current user. We filter in JS against the events that are in this window.
export async function listEventsInRange(
  startMs: number,
  endMs: number,
  categories: Category[]
): Promise<DayEvent[]> {
  const supabase = await createClient();

  const [eventsResult, exclusionsResult, overridesResult] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time")
      .lt("start_time", new Date(endMs).toISOString())
      .gt("end_time", new Date(startMs).toISOString())
      .order("start_time", { ascending: true }),
    supabase.from("event_exclusions").select("event_id"),
    supabase.from("event_categorizations").select("event_id, category_id, source"),
  ]);

  const eventRows = eventsResult.data as Row[] | null;
  if (!eventRows || eventRows.length === 0) return [];

  return toDayEvents(
    eventRows,
    (exclusionsResult.data ?? []) as ExclusionRow[],
    (overridesResult.data ?? []) as OverrideRow[],
    categories
  );
}

// One page of past (already-ended) events for the history surface, newest
// first. Mirrors listSessionHistory's cursor pagination: pass the oldest
// startMs from the prior page as `beforeMs`. Exclusions and the category
// filter resolve in JS (categories come from rules/overrides, not a column),
// so we fetch in oversized batches and keep going until the page is full or
// the table is exhausted — otherwise a sparse category would return a short
// page and the client would wrongly conclude there's nothing older.
export async function listPastEventsPage(opts: {
  categoryId?: string | "none" | null;
  beforeMs?: number | null;
  limit: number;
  categories: Category[];
}): Promise<DayEvent[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [exclusionsResult, overridesResult] = await Promise.all([
    supabase.from("event_exclusions").select("event_id"),
    supabase.from("event_categorizations").select("event_id, category_id, source"),
  ]);
  const exclusions = (exclusionsResult.data ?? []) as ExclusionRow[];
  const overrides = (overridesResult.data ?? []) as OverrideRow[];

  const matchesFilter = (e: DayEvent): boolean => {
    if (opts.categoryId === "none") return e.category === null;
    if (opts.categoryId) return e.category?.id === opts.categoryId;
    return true;
  };

  const batchSize = Math.max(opts.limit, 200);
  const out: DayEvent[] = [];
  let cursorIso =
    opts.beforeMs != null ? new Date(opts.beforeMs).toISOString() : null;

  while (out.length < opts.limit) {
    let query = supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time")
      .lte("end_time", nowIso)
      .order("start_time", { ascending: false })
      .limit(batchSize);
    if (cursorIso) query = query.lt("start_time", cursorIso);

    const { data } = await query;
    const batch = (data ?? []) as Row[];
    if (batch.length === 0) break;

    out.push(
      ...toDayEvents(batch, exclusions, overrides, opts.categories).filter(
        matchesFilter
      )
    );

    if (batch.length < batchSize) break;
    cursorIso = batch[batch.length - 1].start_time;
  }

  return out.slice(0, opts.limit);
}
