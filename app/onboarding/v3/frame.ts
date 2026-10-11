// The v3 wizard's frame, shared by the shell (onboarding-client-v3.tsx) and its
// loading skeleton (wizard-skeleton.tsx) so the skeleton can't drift from the
// screen it stands in for. Coordinates in the comments are the handoff's 393 ×
// 852 frame (R:20), where content starts at y≈54 under the status bar.
//
// Not "layout.ts": under app/ that name is a Next.js Layout for its folder, and
// `next build` fails its type check when the file has no default component.

import { KEYBOARD_CTA_GAP_PX } from "@/lib/keyboard";

// The whole viewport, fixed (plan §6): the keyboard then pans the visual
// viewport over a shell that doesn't move, and useKeyboardInset's arithmetic
// holds. z-50 sits it over the BottomNav (z-40), which the dev preview can
// still render underneath for a signed-in, onboarded developer.
export const V3_FRAME = "bg-screen fixed inset-0 z-50 overflow-hidden overscroll-none";

// One phone-width column, centred on anything wider. The status bar's inset is
// added here because a fixed element ignores the body's safe-area padding.
// Everything inside is positioned against this element.
export const V3_COLUMN =
  "relative mx-auto flex h-full w-full max-w-[430px] flex-col pt-[env(safe-area-inset-top)]";

// The top row (R:35-37): back (20,64) 32px, then 12px, the progress bar from
// x=64, 12px, and the 28px avatar slot at (345,66).
export const V3_TOP_ROW = "mt-2.5 flex h-8 shrink-0 items-center gap-3 px-5";

// The progress track in that row: 3px tall with its top at y=79 (R:36), 15px
// below the row's top. Centring a 3px bar in the 32px row puts it at 14.5, so
// the 1px top margin makes the centred box 4px tall and lands the bar on 15.
export const PROGRESS_TRACK = "bg-track mt-px h-[3px] min-w-0 flex-1 overflow-hidden rounded-full";

// The replay-only ✕ at the end of the top row (plan D6), and the skeleton's
// stand-in for it: 32px, pulled 6px into the gutter. The progress bar gives
// up its width, so the avatar slot sits further left on a replay.
export const CLOSE_SLOT = "-mr-1.5 size-8 shrink-0";

// The CTA's resting bottom edge: 8px above the home indicator (y=758+52 in an
// 852 frame with a 34px indicator, R:38), and never closer than 20px to the
// bottom of a screen that has no indicator.
export const CTA_REST_BOTTOM = "max(calc(env(safe-area-inset-bottom) + 8px), 20px)";

// How far the CTA rises: enough to rest KEYBOARD_CTA_GAP_PX above the
// keyboard, and not at all while the keyboard is lower than its resting
// spot. --kb-inset comes from KeyboardInsetVar (onboarding-cta.tsx); with no
// keyboard it's 0px and this is translateY(0). Anything that rides up with
// the CTA (Screen 2's example chips, R:94) uses the same lift, so the two
// can't drift apart.
export const KEYBOARD_LIFT = `translateY(calc(-1 * max(0px, var(--kb-inset, 0px) + ${KEYBOARD_CTA_GAP_PX}px - ${CTA_REST_BOTTOM})))`;

// Where something resting `gapPx` above the CTA puts its bottom edge: the
// CTA's own bottom, its 52px (R:38), and the gap.
export function aboveCta(gapPx: number): string {
  return `calc(${CTA_REST_BOTTOM} + 52px + ${gapPx}px)`;
}

// The same, for something that has to stay above the CTA while it rides on
// the keyboard: aboveCta's edge plus KEYBOARD_LIFT's distance. For a box that
// should shrink rather than move with the keyboard, such as the UW page's
// quick-add, which scrolls (R:83: "to just above the CTA (or keyboard)").
export function aboveLiftedCta(gapPx: number): string {
  return `calc(${CTA_REST_BOTTOM} + 52px + ${gapPx}px + max(0px, var(--kb-inset, 0px) + ${KEYBOARD_CTA_GAP_PX}px - ${CTA_REST_BOTTOM}))`;
}

// ---- The UW sheet (OWNER-FIX-3) -----------------------------------------------

// Its bottom padding: the home indicator, never less than 20px, as
// components/v2/bottom-sheet.tsx has it.
export const SHEET_PAD_BOTTOM = "max(env(safe-area-inset-bottom), 20px)";

// Its tallest: 86% of the screen, as bottom-sheet.tsx's, and never up under
// the status bar. It only asks the question (OWNER-FIX-4 moved the Yes path's
// fields to the UW page), so it has no keyboard to ride; this only matters on
// a screen too short for its tiles, which then scroll.
export const SHEET_MAX_HEIGHT = "min(86dvh, 100dvh - env(safe-area-inset-top) - 12px)";
