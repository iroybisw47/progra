"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SearchIcon } from "lucide-react";

import {
  SEARCH_BLUR_DEBOUNCE_MS,
  SEARCH_COPY,
  SEARCH_DEBOUNCE_MS,
  SEARCH_INPUT_MAX,
  isSearchMode,
  searchAnnouncement,
  searchView,
  type SearchAnswer,
  type SearchView,
} from "@/lib/find-friends";
import { SEARCH_QUERY_MIN, normalizeSearchQuery } from "@/lib/social/username";
import { cn } from "@/lib/utils";

// The redesign's people search (R:134), in three parts so each screen can lay
// it out its own way: usePeopleSearch (the field's state, search mode and the
// debounced search), PeopleSearchField (the 44px field and "Cancel") and
// PeopleSearchResults (the list under it). Onboarding v3's Screen 5 slides
// the field up 174px into search mode (find-friends-screen.tsx); the v3
// Friends tab (P8) keeps it at the top and hides its sections instead
// (R:164). lib/find-friends.ts holds the rules and the copy.

type SearchFn<T> = (q: string) => Promise<{ results: T[] } | { error: string }>;

export type PeopleSearch<T> = {
  text: string;
  focused: boolean;
  // Focused or holding a query (R:134).
  mode: boolean;
  view: SearchView<T>;
  setText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  // "Cancel": empty the field and leave search mode at once. The field moves
  // focus off the input itself, which gives the keyboard back.
  cancel: () => void;
};

// The search's state. `search` is searchUsers (or the dev preview's fake),
// and must be a stable function: a new one each render would restart the
// debounce on every render. It runs SEARCH_DEBOUNCE_MS after typing pauses,
// on the query normalized exactly as the action normalizes it, and only from
// SEARCH_QUERY_MIN characters, so "@p" never goes out. An answer that arrives after the query has moved on is
// dropped (the effect's cleanup stops listening), so a slow reply to "pri"
// can't land over "priya". searchView decides what the list shows meanwhile.
//
// Focus leaving counts only after SEARCH_BLUR_DEBOUNCE_MS (P:732), so a tap
// that blurs and refocuses doesn't drop out of search mode and back.
export function usePeopleSearch<T>({
  search,
  initialText = "",
}: {
  search: SearchFn<T>;
  // Dev preview only: the field opens with this typed.
  initialText?: string;
}): PeopleSearch<T> {
  const [text, setTextState] = useState(initialText.slice(0, SEARCH_INPUT_MAX));
  const [focused, setFocused] = useState(false);
  const [last, setLast] = useState<SearchAnswer<T> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = normalizeSearchQuery(text);
  useEffect(() => {
    if (q.length < SEARCH_QUERY_MIN) return;
    let live = true;
    const t = setTimeout(() => {
      search(q).then(
        (r) => {
          if (live) setLast("error" in r ? { q, error: r.error } : { q, rows: r.results });
        },
        () => {
          if (live) setLast({ q, error: SEARCH_COPY.failed });
        }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, search]);

  // Unmount only: a pending blur mustn't set state afterwards.
  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  function clearBlur() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = null;
  }

  return {
    text,
    focused,
    mode: isSearchMode(focused, text),
    view: searchView(text, last),
    setText: (next) => setTextState(next.slice(0, SEARCH_INPUT_MAX)),
    onFocus() {
      clearBlur();
      setFocused(true);
    },
    onBlur() {
      clearBlur();
      blurTimer.current = setTimeout(() => {
        blurTimer.current = null;
        setFocused(false);
      }, SEARCH_BLUR_DEBOUNCE_MS);
    },
    cancel() {
      clearBlur();
      setTextState("");
      setFocused(false);
    },
  };
}

// The field (R:134): 44px, radius 12, a 1.5px border that turns --brand while
// the input has focus, a 15px magnifier and 15px text. "Cancel" (13/600
// --brand) sits beside it in search mode. Its pointerdown is prevented so
// pressing it doesn't blur the field first and flicker the keyboard; the
// click empties and blurs it on purpose.
//
// Return closes the keyboard and keeps the results, so they can be seen above
// the CTA. Escape is Cancel.
//
// Keyboard and assistive tech: focus on Cancel counts as focus on the field,
// so Tabbing to it on an empty field doesn't end search mode and unmount it
// under the focus. And wherever the field lets go of focus (Return, Escape,
// Cancel), focus is parked on the field's row rather than dropped to the page,
// so Tab carries on from here: back into the input, or on past it.
export function PeopleSearchField<T>({
  search,
  label = SEARCH_COPY.placeholder,
}: {
  search: PeopleSearch<T>;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Focus the row itself (focusable only while focused, as the wizard focuses
  // a screen's section), after the input is blurred so the keyboard drops.
  function letGo() {
    inputRef.current?.blur();
    const row = rowRef.current;
    if (!row) return;
    row.setAttribute("tabindex", "-1");
    row.addEventListener("blur", () => row.removeAttribute("tabindex"), { once: true });
    row.focus({ preventScroll: true });
  }
  // Let go first, so the blur's own grace timer is the one cancel() clears.
  function cancel() {
    letGo();
    search.cancel();
  }
  return (
    <div ref={rowRef} className="flex items-center gap-2.5 outline-none">
      <label className="border-control-border focus-within:border-brand flex h-[44px] min-w-0 flex-1 items-center gap-2 rounded-[12px] border-[1.5px] bg-card px-3 transition-colors duration-200">
        <SearchIcon aria-hidden className="text-caption size-[15px] shrink-0" strokeWidth={2.2} />
        <input
          ref={inputRef}
          type="text"
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          onFocus={search.onFocus}
          onBlur={search.onBlur}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            else if (e.key === "Enter") letGo();
          }}
          maxLength={SEARCH_INPUT_MAX}
          aria-label={label}
          placeholder={SEARCH_COPY.placeholder}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="text-body placeholder:text-disabled h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] outline-none"
        />
      </label>
      {search.mode && (
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={cancel}
          onFocus={search.onFocus}
          onBlur={search.onBlur}
          className="text-brand relative shrink-0 text-[13px] font-semibold before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']"
        >
          {SEARCH_COPY.cancel}
        </button>
      )}
    </div>
  );
}

// What sits under the field in search mode (R:134): the "Results" eyebrow
// and up to five rows, or one note: the hint, the wait, "no one", or a
// failure. Each row is the caller's (a PersonRow with whatever action fits
// the screen). A visually hidden live region says how many came back.
//
// headerTop: the eyebrow's top padding, Screen 5's 14px (R:136) or the
// Friends tab's 16px, which its own section headers use too (P:428).
export function PeopleSearchResults<T>({
  view,
  rowKey,
  renderRow,
  headerTop = "screen",
}: {
  view: SearchView<T>;
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  headerTop?: "screen" | "tab";
}) {
  let body: ReactNode;
  if (view.kind === "results") {
    body = (
      <>
        <div
          className={cn(
            "flex items-center gap-[7px] px-5 pb-2",
            headerTop === "tab" ? "pt-4" : "pt-3.5"
          )}
        >
          <span className="section-label">{SEARCH_COPY.results}</span>
        </div>
        <ul role="list" aria-label={SEARCH_COPY.results}>
          {view.rows.map((row) => (
            <li key={rowKey(row)}>{renderRow(row)}</li>
          ))}
        </ul>
      </>
    );
  } else {
    const note =
      view.kind === "hint"
        ? SEARCH_COPY.hint
        : view.kind === "searching"
          ? SEARCH_COPY.searching
          : view.kind === "none"
            ? SEARCH_COPY.noHits
            : view.message;
    body = <ListNote>{note}</ListNote>;
  }
  return (
    <>
      {body}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchAnnouncement(view)}
      </p>
    </>
  );
}

// A note in place of rows (P:325): 13px --caption under a divider, padded
// like a row. The search's hints use it, and so do the screens around it
// (Screen 5's "Progra works best…", the Friends tab's empty states).
export function ListNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-divider text-caption m-0 border-t px-5 py-3 text-[13px] leading-[1.45] text-pretty">
      {children}
    </p>
  );
}
