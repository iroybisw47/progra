"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { CheckIcon } from "lucide-react";

import { EASING, SHEET, boxOf, motion, play, transition, type Box } from "@/lib/motion";
import type { UwChoice, UwPhase } from "@/lib/onboarding-v3";
import {
  UW_COPY,
  sheetArmMs,
  sheetDragDismisses,
  sheetDragOffset,
  sheetTapCounts,
  uwDelay,
  uwTileStyle,
  uwTilesInteractive,
  uwTilesNote,
  type UwView,
} from "@/lib/onboarding-v3-uw";

import { SHEET_MAX_HEIGHT, SHEET_PAD_BOTTOM } from "./frame";

// The UW question as a bottom sheet over the welcome screen (OWNER-FIX-3),
// behind UW: the welcome's Continue raises it once the identity is saved.
// "Are you a UW student?" and its two tiles (R:75-79). No saves and moves on
// to Screen 2. Yes holds its selected state, then the sheet goes and the UW
// page comes in its place (uw-screen.tsx, OWNER-FIX-4: the owner asked for
// the Yes path as a full page, not inside the sheet), the tile morphing into
// the page's bar: the sheet hands the tile's box on screen to the shell as
// the hold ends (onOpen). The rules it draws by, and what each answer saves,
// are lib/onboarding-v3-uw.ts. The answer itself, and whether the sheet is
// up, are the wizard's reducer, and the shell (onboarding-client-v3.tsx) runs
// the writes and moves on.
//
// The look is components/v2/bottom-sheet.tsx's: white, a 26px top radius, a
// grab handle, the home indicator's padding at the bottom. It isn't that
// component because that one portals out of the wizard, and this one sits
// inside it, over the welcome. So the dialog semantics are its own: the
// welcome behind it is inert, its title names it, it takes the focus as it
// opens, Tab stays inside, and Escape, a tap on the dimmed welcome, a drag
// down on the handle or a hidden Close put it away unanswered
// (uwSheetDismissible), leaving the welcome as it was. Motion is transform
// and opacity only: it rises on KB and goes down a little quicker
// (lib/motion.ts SHEET), and fades instead under reduced motion. It has no
// fields, so no keyboard to ride.
//
// It loads as its own chunk (onboarding-client-v3.tsx imports it through
// next/dynamic, AGENTS.md's rule for dialogs), so only a wizard with UW on
// fetches it. Its writes are uw-writes.ts', which stay in the shell's.

export function UwSheet({
  open,
  reduced,
  uw,
  uwPhase,
  inCohort,
  dismissible,
  onTap,
  onOpen,
  onDismiss,
}: {
  // Up over the welcome screen (the reducer's uwSheet, on Screen 1).
  open: boolean;
  reduced: boolean;
  uw: UwChoice | null;
  uwPhase: UwPhase;
  // The profile is in the cohort as stored (uw-writes.ts): the tiles say
  // what No clears (uwTilesNote).
  inCohort: boolean;
  // Whether it may be put away unanswered now (uwSheetDismissible).
  dismissible: boolean;
  // A tile tapped. The shell decides whether it counts (uwTileTap).
  onTap: (choice: UwChoice) => void;
  // Yes has held its selected state: the UW page comes, its bar morphing
  // from the tile, whose box on screen this is.
  onOpen: (tile: Box | null) => void;
  // Put away unanswered: Escape, the dimmed welcome, the handle dragged down
  // or the hidden Close. Only offered while `dismissible`.
  onDismiss: () => void;
}) {
  const titleId = useId();
  const tilesNoteId = `${titleId}-tiles-note`;
  const panelRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const yesCheckRef = useRef<HTMLSpanElement>(null);
  const noCheckRef = useRef<HTMLSpanElement>(null);

  const view: UwView = { uw, uwPhase, reduced };
  const tilesLive = uwTilesInteractive({ uwSheet: open, uwPhase });
  // Not once Yes has gone on to its page: the sheet is on its way down then.
  const tilesNote = uwPhase === "open" ? null : uwTilesNote(inCohort);

  // Rising, it takes the focus itself (not its first tile, which would read
  // as a selection), so it's announced by its title and the keyboard of a
  // field left focused on the welcome goes down. So does a sheet that mounts
  // already up: its chunk can land after the Continue that raised it, on a
  // slow network. A drag that put it away left the sheet where the finger
  // let go; that's cleared before it shows again.
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    const was = wasOpen.current;
    wasOpen.current = open;
    const panel = panelRef.current;
    if (!open || was || !panel) return;
    panel.style.transform = "";
    panel.style.transition = "";
    panel.focus({ preventScroll: true });
  }, [open]);

  // Taps count only once it's up (sheetTapCounts): armed as the rise ends,
  // and a pointer's click only if its press began after that.
  const armedAt = useRef<number | null>(null);
  const pressedAt = useRef(-Infinity);
  useEffect(() => {
    armedAt.current = null;
    if (!open) return;
    const t = setTimeout(() => {
      armedAt.current = performance.now();
    }, sheetArmMs(reduced));
    return () => clearTimeout(t);
  }, [open, reduced]);
  function notePress() {
    pressedAt.current = performance.now();
  }
  function tapCounts(e: ReactMouseEvent): boolean {
    return sheetTapCounts(armedAt.current, pressedAt.current, e.detail);
  }
  function tapTile(choice: UwChoice, e: ReactMouseEvent) {
    if (tapCounts(e)) onTap(choice);
  }

  // A tile taken: its check pops in and the tile bounces (R:77, R:49), the
  // other fades and drops through its style (uwTileStyle). On the change into
  // the selected state only, so a sheet that opens there (the uw-sheet-no
  // preview) doesn't play it.
  const lastPhase = useRef(uwPhase);
  useEffect(() => {
    const was = lastPhase.current;
    lastPhase.current = uwPhase;
    if (uwPhase !== "selecting" || was === "selecting" || !uw) return;
    play((uw === "yes" ? yesCheckRef : noCheckRef).current, motion("checkPop", reduced));
    play((uw === "yes" ? yesRef : noRef).current, motion("tileBounce", reduced));
  }, [uwPhase, uw, reduced]);

  // Yes holds its selected state for 320ms (R:80), then the UW page comes,
  // its bar morphing from the tile, measured here as the hold ends. No's own
  // wait is the shell's, since it ends in the save and Screen 2.
  useEffect(() => {
    if (!open || uw !== "yes" || uwPhase !== "selecting") return;
    const t = setTimeout(() => {
      const tile = yesRef.current;
      onOpen(tile ? boxOf(tile) : null);
    }, uwDelay("yesOpenMs", reduced));
    return () => clearTimeout(t);
    // onOpen only dispatches, so the one from the render that started the
    // wait is as good as the latest. With it in the deps, every render of
    // the shell during the wait would restart the 320ms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, uw, uwPhase, reduced]);

  // Tab stays inside, as a modal's should: from the last control to the first
  // and back. Everything behind is inert, so without this Tab leaves the page.
  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("button, input, [tabindex]")
    ).filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.closest("[inert]") &&
        !(el instanceof HTMLButtonElement && el.disabled) &&
        el.getClientRects().length > 0
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const a = document.activeElement;
    const wrap = e.shiftKey ? a === first || a === e.currentTarget : a === last;
    if (!wrap) return;
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }

  // The grab handle (bottom-sheet.tsx's gesture): the sheet follows the finger
  // down and resists going up (sheetDragOffset). Let go past the threshold and
  // it's put away from where it is; short of it, it settles back. Only while
  // it may be put away at all.
  function dragHandle(e: ReactPointerEvent<HTMLDivElement>) {
    const handle = e.currentTarget;
    const panel = panelRef.current;
    if (!panel || !dismissible) return;
    handle.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    let dy = 0;
    const move = (ev: PointerEvent) => {
      dy = ev.clientY - y0;
      panel.style.transition = "none";
      panel.style.transform = `translateY(${sheetDragOffset(dy)}px)`;
    };
    const settle = () => {
      panel.style.transition = transition([SHEET.settle]);
      panel.style.transform = "translateY(0)";
    };
    const end = (dismiss: boolean) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", cancel);
      if (dismiss && sheetDragDismisses(dy)) onDismiss();
      else settle();
    };
    const up = () => end(true);
    const cancel = () => end(false);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", cancel);
  }

  return (
    <>
      {/* The welcome, dimmed. A tap on it puts the sheet away unanswered. */}
      <div
        aria-hidden
        onPointerDownCapture={notePress}
        onClick={(e) => {
          if (tapCounts(e) && dismissible) onDismiss();
        }}
        className="absolute inset-0 z-20 bg-backdrop"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: transition(reduced ? SHEET.backdrop.reduced : SHEET.backdrop.normal),
        }}
      />

      {/* Bottom-anchored, one phone-width column wide. */}
      <div
        inert={!open}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] px-2"
      >
        <div
          style={
            reduced
              ? {
                  opacity: open ? 1 : 0,
                  transition: transition(open ? SHEET.in.reduced : SHEET.out.reduced),
                }
              : {
                  transform: open ? "none" : SHEET.from,
                  transition: transition(open ? SHEET.in.normal : SHEET.out.normal),
                }
          }
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                trapTab(e);
                return;
              }
              if (e.key !== "Escape" || !dismissible) return;
              e.preventDefault();
              onDismiss();
            }}
            // The white below its bottom edge: when it's dragged up, the
            // screen's bottom stays covered. It tucks a pixel under the edge,
            // so the two never show a seam at a fractional offset mid-move.
            className="text-ink relative flex flex-col rounded-t-[26px] bg-card shadow-[0_-12px_32px_-18px_rgba(18,23,29,.35)] outline-none after:pointer-events-none after:absolute after:inset-x-0 after:top-[calc(100%-1px)] after:h-[100vh] after:bg-card after:content-['']"
            style={{
              maxHeight: SHEET_MAX_HEIGHT,
              paddingBottom: SHEET_PAD_BOTTOM,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            <div
              onPointerDown={dragHandle}
              aria-hidden
              className="flex-none cursor-grab touch-none pt-2.5 pb-3"
            >
              <div className="bg-warm-border mx-auto h-1 w-[38px] rounded-full" />
            </div>

            <div
              className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              // Room under the tiles for their selected shadow and bounce.
              style={{ paddingBottom: 28 }}
            >
              <h2
                id={titleId}
                className="text-ink font-serif text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-pretty"
              >
                {UW_COPY.question}
              </h2>

              {/* While a tile plays its selected state the tiles stay in the
                  tree, so the choice is still announced, and the shell
                  ignores a second tap. */}
              <div
                role="group"
                aria-labelledby={titleId}
                onPointerDownCapture={notePress}
                inert={!tilesLive && !(open && uwPhase === "selecting")}
                className="mt-[18px] flex h-[172px] gap-2.5"
                style={{ pointerEvents: tilesLive ? "auto" : "none" }}
              >
                <UwTile
                  which="yes"
                  view={view}
                  buttonRef={yesRef}
                  checkRef={yesCheckRef}
                  onTap={tapTile}
                />
                <UwTile
                  which="no"
                  view={view}
                  buttonRef={noRef}
                  checkRef={noCheckRef}
                  onTap={tapTile}
                  describedBy={tilesNote ? tilesNoteId : undefined}
                />
              </div>

              {/* What No clears, for someone the profile has in the cohort
                  (uwTilesNote), before the tap: No saves and moves on by
                  itself. */}
              {tilesNote && (
                <p
                  id={tilesNoteId}
                  className="text-caption mt-3 text-[11px] leading-[15px] text-pretty"
                >
                  {tilesNote}
                </p>
              )}
            </div>

            {/* Escape and the dimmed welcome, for VoiceOver and Switch
                Control, which can reach neither: put away unanswered. */}
            <button
              type="button"
              className="sr-only"
              aria-disabled={!dismissible || undefined}
              onClick={() => {
                if (dismissible) onDismiss();
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// One of the two tiles (R:76-77): white with a 26px empty circle, "Yes" or
// "No" over its line, and a selected layer that fades in over it in the
// answer's color with a white check. The selected layer is decoration, so
// the button's name is the white layer's words, and aria-pressed says which
// was taken.
function UwTile({
  which,
  view,
  buttonRef,
  checkRef,
  onTap,
  describedBy,
}: {
  which: UwChoice;
  view: UwView;
  buttonRef: RefObject<HTMLButtonElement | null>;
  checkRef: RefObject<HTMLSpanElement | null>;
  onTap: (choice: UwChoice, e: ReactMouseEvent) => void;
  describedBy?: string;
}) {
  const s = uwTileStyle(view, which);
  const copy = UW_COPY[which];
  // Yes is palette 9, the design's dark purple (an approved deviation from
  // "palette is data", R:77). No is the brand navy.
  const fill = which === "yes" ? "var(--palette-9)" : "var(--brand)";
  const shadow =
    which === "yes"
      ? "0 14px 28px -14px rgba(111,78,147,.6)"
      : "0 14px 28px -14px rgba(28,58,94,.65)";
  return (
    <div
      className="flex min-w-0 flex-1"
      style={{ opacity: s.opacity, transform: s.transform, transition: s.transition }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={s.selected}
        aria-describedby={describedBy}
        onClick={(e) => onTap(which, e)}
        className="relative min-w-0 flex-1 overflow-hidden rounded-[18px] border-[1.5px] bg-card text-left active:scale-[.98]"
        style={{
          borderColor: s.selected ? fill : "var(--control-border)",
          boxShadow: s.selected ? shadow : "none",
          // Tailwind 4's active:scale-* sets `scale`, not `transform`, so the
          // press eases only with `scale` listed (R:76, P:66).
          transition: `transform 160ms ${EASING.E}, scale 160ms ${EASING.E}, box-shadow 240ms ease`,
        }}
      >
        <span className="absolute inset-0 flex flex-col justify-between p-[18px]">
          <span
            aria-hidden
            className="border-control-border size-[26px] self-end rounded-full border-[1.5px]"
          />
          <span className="flex flex-col gap-2">
            <span className="text-ink font-serif text-[56px] leading-[0.9] font-medium tracking-[-0.025em]">
              {copy.label}
            </span>
            <span className="text-secondary-ink text-[13px] leading-[1.35]">{copy.sub}</span>
          </span>
        </span>
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col justify-between p-[18px]"
          style={{
            background: fill,
            opacity: s.selected ? 1 : 0,
            transition: "opacity 180ms linear",
          }}
        >
          <span
            ref={checkRef}
            className="flex size-[26px] items-center justify-center self-end rounded-full bg-white"
            style={{ color: fill }}
          >
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </span>
          <span className="flex flex-col gap-2">
            <span className="font-serif text-[56px] leading-[0.9] font-medium tracking-[-0.025em] text-white">
              {copy.label}
            </span>
            <span className="text-[13px] leading-[1.35] text-white/75">{copy.sub}</span>
          </span>
        </span>
      </button>
    </div>
  );
}
