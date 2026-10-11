"use client";

import type { ComponentProps, ReactNode } from "react";

import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import { ListNote } from "@/components/v2/people-search";
import { PersonRow } from "@/components/v2/person-row";
import type { BlockedEntry, PublicUser, RequestEntry } from "@/lib/db/friends";
import { FRIENDS_TAB_COPY, type Said } from "@/lib/friends-tab";

// The v3 Friends tab's "Sent requests · Blocked" sheet (D12): the requests
// the viewer has out, each with Cancel, and the people they've blocked, each
// with Unblock. The old tab listed both at the bottom of the page; they're
// rarely needed, so they moved behind one quiet row, but this is still the
// ONLY place in the app to unblock someone, so it has to keep working.
//
// Loaded with next/dynamic from friends-client-v3.tsx, per the repo's dialog
// rule: most visits never open it. The writes are the tab's (its optimistic
// overlay, toasts and revert); this only lists and calls back. Rows don't link
// to profiles: a blocked person's profile shows nothing, and leaving from
// inside a sheet strands it.
//
// Under reduced motion it doesn't rise (R:54, "Nothing travels"): it fades
// with its backdrop instead. No page-level rule reaches it, as it's portalled
// out of the tab, so the utilities sit on the sheet itself.
const STILL =
  "motion-reduce:data-open:slide-in-from-bottom-0 motion-reduce:data-open:fade-in-0 motion-reduce:data-closed:slide-out-to-bottom-0 motion-reduce:data-closed:fade-out-0";

export function SentBlockedSheet({
  open,
  onOpenChange,
  outgoing,
  blocked,
  onCancel,
  onUnblock,
  said,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outgoing: readonly RequestEntry[];
  blocked: readonly BlockedEntry[];
  onCancel: (request: RequestEntry) => void;
  onUnblock: (user: PublicUser) => void;
  // The sheet's own hidden status line (lib/friends-tab.ts FRIENDS_TAB_SAID):
  // while it's open, Base UI hides the rest of the page, the tab's line and
  // the pill included, from a screen reader.
  said: Said | null;
  // Where focus returns on close (the tab's sheetFinalFocus).
  finalFocus: ComponentProps<typeof BottomSheetContent>["finalFocus"];
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        title={FRIENDS_TAB_COPY.sentBlocked}
        className={STILL}
        finalFocus={finalFocus}
      >
        <p role="status" className="sr-only">
          {said && <span key={said.id}>{said.text}</span>}
        </p>
        {/* The sheet pads its content 20px; the rows bring their own. */}
        <div className="-mx-5 flex flex-col pb-1">
          <SheetSection label={FRIENDS_TAB_COPY.sent} count={outgoing.length}>
            {outgoing.length === 0 ? (
              <ListNote>{FRIENDS_TAB_COPY.noneSent}</ListNote>
            ) : (
              <ul role="list">
                {outgoing.map((r) => (
                  <li key={r.requestId}>
                    <PersonRow
                      name={r.user.displayName}
                      username={r.user.username}
                      avatarUrl={r.user.avatarUrl}
                      subline={r.user.displayName ? `@${r.user.username}` : null}
                      action={{
                        kind: "button",
                        label: FRIENDS_TAB_COPY.cancel,
                        onPress: () => onCancel(r),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SheetSection>
          <SheetSection label={FRIENDS_TAB_COPY.blocked} count={blocked.length}>
            {blocked.length === 0 ? (
              <ListNote>{FRIENDS_TAB_COPY.noneBlocked}</ListNote>
            ) : (
              <ul role="list">
                {blocked.map((b) => (
                  <li key={b.user.userId}>
                    <PersonRow
                      name={b.user.displayName}
                      username={b.user.username}
                      avatarUrl={b.user.avatarUrl}
                      subline={b.user.displayName ? `@${b.user.username}` : null}
                      action={{
                        kind: "button",
                        label: FRIENDS_TAB_COPY.unblock,
                        onPress: () => onUnblock(b.user),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SheetSection>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

// A section of the sheet, headed like the tab's own: the eyebrow and a count.
function SheetSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col not-first:pt-3">
      <div className="flex items-center gap-[7px] px-5 pt-2 pb-2">
        <h3 className="section-label font-sans">{label}</h3>
        <span className="flex-1" />
        {count > 0 && (
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
