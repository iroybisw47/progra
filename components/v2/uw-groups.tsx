"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  NO_PAGING,
  UW_BUCKET_FOR,
  UW_GROUPS_COPY,
  mergeUwPage,
  uwNextCursor,
  type UwPaging,
} from "@/lib/uw-groups";
import type { UwPeerPageResult } from "@/lib/onboarding-v3-services";
import type { UwBucket, UwGroupKey, UwPeerCursor, UwPeerGroups } from "@/lib/uw-peers";
import { cn } from "@/lib/utils";

// The UW groups' moving parts that onboarding v3's Screen 5 and the v3
// Friends tab share (plan P9d): paging a group past its first page and the
// row that asks for the next one. Plus Screen 5's own quiet rows for while
// its groups load (the tab's arrive with the page). The rules are
// lib/uw-groups.ts; each screen lays the groups out its own way, as each
// does the people search.

// ---- Paging ------------------------------------------------------------------------

export type UwGroupPagingApi = {
  paging: UwPaging;
  // A page for this group is out.
  loading: (key: UwGroupKey) => boolean;
  // Its last ask failed. The row stops asking on its own until tapped, so a
  // dead connection doesn't retry on every frame the row is in view.
  failed: (key: UwGroupKey) => boolean;
  // Ask for the group's next page, if it has one and none is out.
  more: (key: UwGroupKey) => void;
};

type PagingState = {
  generation: string;
  paging: UwPaging;
  loading: readonly UwGroupKey[];
  failed: readonly UwGroupKey[];
};

function fresh(generation: string): PagingState {
  return { generation, paging: NO_PAGING, loading: [], failed: [] };
}

const without = (list: readonly UwGroupKey[], key: UwGroupKey) => list.filter((k) => k !== key);

// The pages a screen has loaded past each group's first, through
// fetchMoreUwPeers. `groups` is the first page of each (the Friends tab's
// server read, which refreshes; Screen 5's one fetch), and `generation`
// names it: a new generation is a different answer (Screen 5 refetched for
// new majors), and the pages loaded for the old one are dropped with it. A
// refresh of the same answer keeps them, and lib/uw-groups.ts merges the two.
//
// Each ask remembers the cursor and the first page it was made from, which
// is what mergeUwPage needs to place the answer. An answer for an older
// generation, or for a cursor the group has moved past, changes nothing. A
// failure toasts the action's own words and leaves the row to be tapped.
export function useUwGroupPaging({
  groups,
  generation,
  fetchMore,
}: {
  groups: UwPeerGroups | null;
  generation: string;
  fetchMore: (bucket: UwBucket, cursor: UwPeerCursor) => Promise<UwPeerPageResult>;
}): UwGroupPagingApi {
  const [stored, setStored] = useState<PagingState>(() => fresh(generation));
  const state = stored.generation === generation ? stored : fresh(generation);
  // Asks in flight, by generation and group, so two triggers in one frame
  // (the row coming into view as it's tapped) send one.
  const asking = useRef(new Set<string>());

  function more(key: UwGroupKey) {
    if (!groups) return;
    const after = uwNextCursor(groups, state.paging, key);
    const flight = `${generation}:${key}`;
    if (!after || asking.current.has(flight)) return;
    asking.current.add(flight);
    const gen = generation;
    const base = groups[key];
    setStored((now) => {
      const s = now.generation === gen ? now : fresh(gen);
      return { ...s, loading: [...without(s.loading, key), key], failed: without(s.failed, key) };
    });
    const land = (result: UwPeerPageResult) => {
      asking.current.delete(flight);
      if ("error" in result) toast.error(result.error);
      setStored((now) => {
        if (now.generation !== gen) return now;
        const loading = without(now.loading, key);
        if ("error" in result) return { ...now, loading, failed: [...without(now.failed, key), key] };
        return { ...now, loading, paging: mergeUwPage(now.paging, key, { after, base }, result.page) };
      });
    };
    fetchMore(UW_BUCKET_FOR[key], after).then(land, () =>
      land({ error: UW_GROUPS_COPY.moreFailed })
    );
  }

  return {
    paging: state.paging,
    loading: (key) => state.loading.includes(key),
    failed: (key) => state.failed.includes(key),
    more,
  };
}

// ---- "Show more" ---------------------------------------------------------------------

// The nearest ancestor that scrolls, for the observer's root: Screen 5's list
// clips its rows, so measured against the viewport the row would only count
// as near once it was already showing. Null (the viewport) when the page
// itself scrolls.
function scrollRoot(el: Element): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

const FOCUSABLE = "a[href]:not([tabindex='-1']), button:not([disabled]):not([tabindex='-1'])";

// Where the rows a page adds start: the row above this one as the ask went
// out, and the list both are in.
type Above = { list: Element; last: Element | null };

// Focus after a page lands on a row that held it: the first new row, so the
// next Tab or swipe goes on through what loaded instead of skipping it (and
// the row's name is the news that something did). With nothing new, it stays
// on the row while that's still there, or goes to the last row above it.
function focusFirstNew({ list, last }: Above, button: HTMLElement | null) {
  if (!list.isConnected) return;
  const first = last?.isConnected ? last.nextElementSibling : list.firstElementChild;
  const stay = button?.isConnected ?? false;
  const row = first && !(button && first.contains(button)) ? first : stay ? null : last;
  if (!row?.isConnected) return;
  row.querySelector<HTMLElement>(FOCUSABLE)?.focus();
}

// The last row of a group with more to load (R:192's "paged / infinite
// scroll"): a quiet button, and, while `auto`, a page that loads by itself a
// little before the row scrolls into view (within its scrolling list, or the
// viewport). Only Screen 5 is `auto`, where "More at UW" is the last thing in
// the list. On the Friends tab the groups sit above "Your friends" and the
// Sent · Blocked row, so loading on scroll would push those down a page at a
// time through the whole cohort: there it loads on a tap.
//
// The observer is rebuilt each time a page lands, so a row still in reach
// after one loads asks for the next (an observer only reports a change of
// state, and "still visible" isn't one), and it's off while `auto` is: a
// screen out of view (Screen 5's layer stays mounted and in place, merely
// transparent, which an observer can't tell), and after a failure until the
// row is tapped. Tapping always works, for anyone who doesn't scroll to it.
//
// A page that lands while the row has keyboard or VoiceOver focus hands it to
// the first new row (focusFirstNew), including the last page, which takes
// the row away: left alone, focus would fall to <body>.
export function ShowMoreRow({
  group,
  loading,
  auto,
  onMore,
}: {
  // The group's title, said after "Show more" to a screen reader.
  group: string;
  loading: boolean;
  auto: boolean;
  onMore: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // The latest onMore, for the observer, which outlives the render that made it.
  const onMoreRef = useRef(onMore);
  useEffect(() => {
    onMoreRef.current = onMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!auto || loading || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onMoreRef.current();
      },
      { root: scrollRoot(el), rootMargin: "0px 0px 160px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, loading]);

  // Noted as a page is asked for; used, and cleared, as it lands.
  const above = useRef<Above | null>(null);
  // Whether the row has focus, beside document.activeElement, for the
  // unmount below.
  const focused = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (loading) {
      const li = el.closest("li");
      const list = li?.parentElement;
      above.current = li && list ? { list, last: li.previousElementSibling } : null;
      return;
    }
    // A page that wasn't the last landed, and this row is still here.
    const was = above.current;
    above.current = null;
    if (was && document.activeElement === el) focusFirstNew(was, el);
  }, [loading]);

  // The last page: the row unmounts in the commit that adds its rows. Its
  // cleanup runs while it's still in the document (React clears a removed
  // subtree's effects before detaching it) and before the new rows go in, so
  // the handoff waits for the end of that commit. `focused` covers a browser
  // that has already moved focus to <body>.
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      const was = above.current;
      if (!was || !el) return;
      const active = document.activeElement;
      const had = active === el || ((active === null || active === document.body) && focused.current);
      if (!had) return;
      queueMicrotask(() => {
        const now = document.activeElement;
        if (now === null || now === document.body || now === el) focusFirstNew(was, null);
      });
    };
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (!loading) onMore();
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
      }}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(
        "border-divider text-brand flex w-full items-center border-t px-5 py-3 text-left text-[13px] font-semibold transition-opacity active:opacity-60",
        loading && "opacity-50"
      )}
    >
      {UW_GROUPS_COPY.showMore}
      <span className="sr-only"> {group}</span>
    </button>
  );
}

// ---- Loading -----------------------------------------------------------------------

// Screen 5's wait for a UW student's groups: a header's worth of space and
// three still rows in the person row's shape (36px circle, two short lines),
// in --track, with no shimmer. Quiet on purpose: the fetch starts back on
// Screen 2, so it's rarely seen, and it says nothing it might have to take
// back. Hidden from a screen reader: Screen 5's own status line, which stays
// mounted, says that it's looking and what it found.
export function UwGroupsLoading() {
  return (
    <div aria-hidden>
      <div className="px-5 pt-3.5 pb-2">
        <span className="bg-track block h-2.5 w-24 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]"
        >
          <span className="bg-track size-9 shrink-0 rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="bg-track block h-2.5 w-[42%] rounded-full" />
            <span className="bg-track block h-2 w-[30%] rounded-full" />
          </span>
        </div>
      ))}
    </div>
  );
}
