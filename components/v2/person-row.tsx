"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import {
  ADD_FAILED,
  UNDO_FAILED,
  addedCount,
  nextAddCall,
  settleAddCall,
  startAddCall,
  toggleAdd,
  type AddCall,
  type AddCallResult,
  type AddPerson,
  type FriendAdds,
} from "@/lib/find-friends";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { motion, play } from "@/lib/motion";
import { cn } from "@/lib/utils";

// One person in the redesign's lists (R:140): onboarding v3's search results
// on Screen 5 now, and the v3 Friends tab's rows in P8. A 36px avatar, the
// name over an 11px line, and one thing on the right: the Add toggle, a status
// ("Friends", "Requested"), Accept, a short figure (this week's hours), or a
// plain button (the Friends tab's sheet).

// The 30px buttons on the right (R:140): radius 10, 12/600, a 1.5px border,
// and pressing scales them to .94. A ::before stretches the touch target to
// 44px tall (7px above and below, inside the 55px row). It doesn't widen a
// button with a label, which is 44px or more across already; the 30px-square
// Decline ✕ widens its own by 7px a side, into the 11px gaps around it.
const SMALL_BUTTON =
  "relative flex h-[30px] shrink-0 items-center gap-[5px] rounded-[10px] border-[1.5px] px-3 text-[12px] font-semibold transition-transform active:scale-[.94] before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-['']";

// Words or a figure in the button's place: 13/600 (P:446).
const STATUS = "shrink-0 text-[13px] font-semibold";

export type PersonAction =
  // Add → "✓ Added", and back (R:140).
  | { kind: "add"; added: boolean; onToggle: () => void }
  // Where search finds someone the viewer already knows (D12, R:164).
  | { kind: "friends" }
  | { kind: "requested" }
  // Their request to the viewer, answered from the row (R:167). Decline is
  // the outlined ✕ beside it, where the row offers one.
  | { kind: "accept"; onAccept: () => void; onDecline?: () => void; busy?: boolean }
  // A figure in place of a button: "Your friends" hours (R:169).
  | { kind: "meta"; text: string }
  // A plain outlined button: the Friends tab's Sent requests · Blocked sheet
  // ("Cancel" a request out, "Unblock", D12).
  | { kind: "button"; label: string; onPress: () => void };

export function PersonRow({
  name,
  username,
  avatarUrl = null,
  subline,
  sublineTone = "faint",
  href,
  action,
}: {
  name: string | null;
  username: string;
  avatarUrl?: string | null;
  // The line under the name: "@handle", "Also studying …" and so on. None
  // leaves the name alone on the row.
  subline?: string | null;
  // --faint by default; the UW groups' reasons are --secondary-ink (R:137-139).
  sublineTone?: "faint" | "secondary";
  // The Friends tab links each row to the profile (D12). Onboarding doesn't:
  // leaving the wizard mid-screen would lose it.
  href?: string;
  action: PersonAction | null;
}) {
  const title = name?.trim() || `@${username}`;
  const who = (
    <>
      <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{title}</span>
      {subline && (
        <span
          className={cn(
            "truncate text-[11px] leading-[1.3]",
            sublineTone === "secondary" ? "text-secondary-ink" : "text-faint"
          )}
        >
          {subline}
        </span>
      )}
    </>
  );
  const avatar = (
    <AvatarInitials
      name={name}
      username={username}
      avatarUrl={avatarUrl}
      className="size-9 text-[13px]"
    />
  );
  return (
    // data-person-row: the Friends tab finds the row again after a tap swaps
    // its button for a status, to put focus back on the row's link.
    <div
      data-person-row
      className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]"
    >
      {href ? (
        <>
          {/* Both links fill the row's full height (the -my/py pair undoes
              the row's own 9px), so a tap anywhere left of the button opens
              the profile, not just on the words. */}
          <Link
            href={href}
            className="-my-[9px] flex shrink-0 items-center self-stretch py-[9px]"
            tabIndex={-1}
            aria-hidden
          >
            {avatar}
          </Link>
          <Link
            href={href}
            className="-my-[9px] flex min-w-0 flex-1 flex-col justify-center gap-px self-stretch py-[9px]"
          >
            {who}
          </Link>
        </>
      ) : (
        <>
          <div className="shrink-0">{avatar}</div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">{who}</div>
        </>
      )}
      {action && <RowAction action={action} title={title} />}
    </div>
  );
}

function RowAction({ action, title }: { action: PersonAction; title: string }) {
  switch (action.kind) {
    case "add":
      return <AddButton added={action.added} onToggle={action.onToggle} title={title} />;
    // The prototype sets "Friends" like the hours beside a friend (P:1288,
    // P:446), and a request still waiting a shade quieter.
    case "friends":
      return <span className={cn(STATUS, "text-body")}>Friends</span>;
    case "requested":
      return <span className={cn(STATUS, "text-caption")}>Requested</span>;
    case "meta":
      return <span className={cn(STATUS, "text-body tabular-nums")}>{action.text}</span>;
    case "button":
      return (
        <button
          type="button"
          onClick={action.onPress}
          className={cn(SMALL_BUTTON, "border-control-border text-caption bg-card")}
        >
          {action.label}
          <span className="sr-only"> {title}</span>
        </button>
      );
    case "accept":
      // 11px between ✕ and Accept: in P:437-439 both sit straight in the
      // row, so they take its gap.
      return (
        <div className="flex shrink-0 items-center gap-[11px]">
          {action.onDecline && (
            <button
              type="button"
              aria-label={`Decline ${title}`}
              aria-disabled={action.busy || undefined}
              onClick={() => {
                if (!action.busy) action.onDecline?.();
              }}
              className={cn(
                SMALL_BUTTON,
                "border-control-border text-caption w-[30px] justify-center bg-card px-0 before:-inset-x-[7px] aria-disabled:opacity-50"
              )}
            >
              <XIcon className="size-[11px]" strokeWidth={3} />
            </button>
          )}
          <button
            type="button"
            aria-disabled={action.busy || undefined}
            onClick={() => {
              if (!action.busy) action.onAccept();
            }}
            className={cn(SMALL_BUTTON, "border-brand bg-brand text-primary-foreground aria-disabled:opacity-50")}
          >
            Accept<span className="sr-only"> {title}</span>
          </button>
        </div>
      );
  }
}

// The colors cross over 180ms (R:140). The press keeps SMALL_BUTTON's scale.
const TOGGLE_TRANSITION =
  "background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 150ms ease";

// The Add toggle (R:140): outlined "Add", then the navy "✓ Added" with a pop,
// and a tap on that takes it back. The colors change over 180ms. It never
// disables itself: a tap while the last one is still with the server is
// queued by useFriendAdds, so the button always shows the latest tap.
//
// Its name is the visible word plus the person ("Added Priya Raman"), so it
// contains the label on screen (WCAG 2.5.3) and the changing word carries the
// state. No aria-pressed, which would announce it a second time.
//
// pointerdown is prevented so tapping Add while searching leaves the keyboard
// up for the next name (as the wizard's chips and CTA do, plan §6). The click
// still fires, and the button is still reachable by Tab.
function AddButton({
  added,
  onToggle,
  title,
}: {
  added: boolean;
  onToggle: () => void;
  title: string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);

  // Pop as it turns on (P:1176), not when it mounts already on (a search
  // finding someone added a moment ago) and not when it turns off.
  const was = useRef(added);
  useEffect(() => {
    if (added && !was.current) play(ref.current, motion("pop", reduced));
    was.current = added;
  }, [added, reduced]);

  return (
    <button
      ref={ref}
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={cn(
        SMALL_BUTTON,
        added ? "border-brand bg-brand text-primary-foreground" : "border-control-border text-caption bg-card"
      )}
      style={{ transition: TOGGLE_TRANSITION }}
    >
      {added && <CheckIcon aria-hidden className="size-[11px]" strokeWidth={3.5} />}
      {added ? "Added" : "Add"}
      <span className="sr-only"> {title}</span>
    </button>
  );
}

// An error from a row's button. The Add and Accept buttons keep the keyboard
// up on purpose, and sonner's toasts sit at the bottom of the layout viewport,
// which the iOS keyboard covers in the WebView (lib/keyboard.ts). So a focused
// field is blurred first, dropping the keyboard (a search keeps its results:
// a query holds search mode), and the reason is actually seen.
export function rowErrorToast(message: string) {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur();
  toast.error(message);
}

// ---- State --------------------------------------------------------------------

export type FriendAddsApi = {
  adds: FriendAdds;
  // How many show "✓ Added" (R:143).
  count: number;
  // The tap. True when it took the count from none to one, the moment Screen
  // 5's CTA turns primary and its ring pulses (R:143).
  toggle: (person: AddPerson) => boolean;
};

// Who's been added, and the calls that make it so: lib/find-friends.ts's
// toggle, run against the server. `send` and `remove` are sendFriendRequest
// and cancelFriendRequest (through onboarding's services seam on Screen 5).
//
// The map is mirrored in a ref, because a call settling has to read what
// taps have happened since it went out, not what its closure saw. Every
// change goes through `commit`, so the two never disagree. A failure toasts
// through sonner (errors stay on its default, D15) with the action's own
// generic message, the keyboard dropped first so it's seen (rowErrorToast).
//
// Held by whatever outlives the list: the wizard shell for Screen 5, so the
// added people survive Back and forward, and the Screen 6 note can count them.
export function useFriendAdds({
  send,
  remove,
  initial,
  onSent,
}: {
  send: (userId: string) => Promise<AddCallResult>;
  remove: (requestId: string) => Promise<AddCallResult>;
  // Who starts added: the requests already out (addsFromOutgoing).
  initial?: FriendAdds;
  // A request the server accepted, for analytics.
  onSent?: (userId: string) => void;
}): FriendAddsApi {
  const [adds, setAdds] = useState<FriendAdds>(() => initial ?? {});
  const live = useRef<FriendAdds>(adds);

  function commit(next: FriendAdds) {
    live.current = next;
    setAdds(next);
  }

  function settle(call: AddCall, result: AddCallResult) {
    const { adds: next, failed } = settleAddCall(live.current, call, result);
    commit(next);
    if (failed) {
      const fallback = call.kind === "send" ? ADD_FAILED : UNDO_FAILED;
      rowErrorToast("error" in result ? result.error : fallback);
    }
    if (call.kind === "send" && !failed && next[call.username]?.requestId) onSent?.(call.userId);
    pump(call.username);
  }

  // Sends whatever call this person's toggle still needs, one at a time.
  function pump(username: string) {
    const call = nextAddCall(live.current, username);
    if (!call) return;
    commit(startAddCall(live.current, call));
    const fallback = { error: call.kind === "send" ? ADD_FAILED : UNDO_FAILED };
    const out = call.kind === "send" ? send(call.userId) : remove(call.requestId);
    out.then(
      (result) => settle(call, result),
      () => settle(call, fallback)
    );
  }

  function toggle(person: AddPerson): boolean {
    const before = addedCount(live.current);
    commit(toggleAdd(live.current, person));
    pump(person.username);
    return before === 0 && addedCount(live.current) > 0;
  }

  return { adds, count: addedCount(adds), toggle };
}
