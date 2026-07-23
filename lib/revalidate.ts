import "server-only";

import { revalidatePath } from "next/cache";

// Shared revalidation surfaces for server actions. Calling revalidatePath
// inside an action makes the action's own POST response carry the re-rendered
// RSC payload for the current route (when it's in the set), so clients don't
// need a follow-up router.refresh(). Keep these centralized: Next currently
// also flags all previously-visited pages to refresh on next navigation, which
// masks an incomplete set — scattered literals would rot silently.
//
// Dynamic routes require the page form: revalidatePath("/x/[y]", "page").

// Everywhere another user's identity or a session/entity label can appear.
const SESSION_PAGES = [
  "/",
  "/clock",
  "/sessions",
  "/feed",
  "/me",
  "/history",
  "/recap",
  "/goals",
  "/onboarding",
] as const;

function revalidateDynamicSessionPages() {
  revalidatePath("/session/[id]", "page");
  revalidatePath("/profile/[username]", "page");
}

// Sessions render on ~a dozen routes AND drive the root layout's BottomNav
// live ticker (app/layout.tsx passes the active session in). A layout
// revalidation re-renders everything — including the nav — in one call.
export function revalidateSessionSurfaces() {
  revalidatePath("/", "layout");
}

// For session actions that end the active session and are followed by a client
// router.push away from /clock/live (clock-out, edit-time-with-end): the live
// page's `if (!active) redirect("/clock")` guard must not re-render in the
// same POST, so this enumerates pages instead of revalidating the layout and
// deliberately omits /clock/live. Trade-off: the nav ticker stays stale until
// the finish screen's save (full revalidation) — invisible in practice, the
// finish overlay covers the nav.
export function revalidateSessionSurfacesExceptLive() {
  for (const p of SESSION_PAGES) revalidatePath(p);
  revalidateDynamicSessionPages();
}

// Category names/colors label sessions and events across every breakdown.
export function revalidateCategorySurfaces() {
  revalidatePath("/");
  revalidatePath("/clock");
  revalidatePath("/categories");
  revalidatePath("/history");
  revalidatePath("/recap");
  revalidatePath("/sessions");
  revalidatePath("/me");
  revalidatePath("/onboarding");
  revalidatePath("/feed");
  revalidateDynamicSessionPages();
}

// Goal titles/quotas surface on the goals page, clock pickers, Progress rows,
// and session attribution pills.
export function revalidateGoalSurfaces() {
  revalidatePath("/goals");
  revalidatePath("/clock");
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/onboarding");
  revalidatePath("/feed");
  revalidateDynamicSessionPages();
}

export function revalidateHabitSurfaces() {
  revalidatePath("/habits");
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/onboarding");
  revalidatePath("/profile/[username]", "page");
}

// Calendar events + their categorizations/exclusions.
export function revalidateEventSurfaces() {
  revalidatePath("/clock");
  revalidatePath("/history");
  revalidatePath("/recap");
  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/sessions");
  revalidatePath("/onboarding");
}

// Calendar connect/disconnect: every event surface plus Settings (the
// Connected row) and onboarding (step 5 state).
export function revalidateCalendarSurfaces() {
  revalidateEventSurfaces();
  revalidatePath("/settings");
}

// Comments + reactions (feed cards, session detail, legacy home feed).
export function revalidateSocialSurfaces() {
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/me");
  revalidateDynamicSessionPages();
}

// Username / display name / bio — anywhere an author is shown.
export function revalidateIdentitySurfaces() {
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/friends");
  revalidatePath("/settings");
  revalidatePath("/me");
  revalidateDynamicSessionPages();
}

export function revalidateFriendSurfaces() {
  revalidatePath("/friends");
  revalidatePath("/feed");
  revalidatePath("/");
  revalidatePath("/profile/[username]", "page");
}
