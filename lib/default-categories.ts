import { PALETTE } from "@/lib/palette";

// The four categories a new account starts with, and the palette colors they
// carry.
//
// These four are NOT created by this repo. The Supabase-side handle_new_user
// (body not in the repo — see ARCHITECTURE.md) seeds them at signup, long
// before completeOnboarding runs, which is why the seeding below corrects a
// color rather than only inserting a missing row.
//
// Colors are picked to stay apart as ADJACENT DONUT ARCS, which is where these
// four sit next to each other most often: blue / green / orange / purple are
// roughly evenly spaced around the wheel, so no two read as the same slice at
// a glance or as 8px dots on a session card.
//
// Names are matched case-insensitively when seeding, so a user who already has
// "study" keeps their row and their color — seeding never overwrites.
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "Class", color: "#395AA0" }, // Dark blue
  { name: "Study", color: "#2E8B50" }, // Green
  { name: "Meetings", color: "#E07042" }, // Orange
  { name: "Personal", color: "#A084B3" }, // Purple
];

// What handle_new_user actually stamps on those four rows today, keyed by
// lowercased name. Measured on prod 2026-09-18: one hex per category across
// 54-57 accounts each, at 98-100% — a system default, not anyone's choice.
//
// They are Tailwind defaults (purple-500, amber-500, blue-500, emerald-500),
// off-palette and absent from LEGACY_FILLS, so normalizeFill() returns null for
// all four and every one renders as the neutral #9fa6b0. That is the bug: on
// every account these four categories are the SAME grey on the donut, in the
// feed and on session cards, and CategoryMarker draws nothing at all.
//
// Correcting a color is gated on an exact match against this map, never on the
// name alone. The 2% that differ are people who re-picked in the color editor
// (both land on retired app hues that normalizeFill maps forward correctly) —
// those are deliberate choices and must survive untouched. The same guard is
// what makes STEP 5 of .claude/plans/category-base-colors.sql safe to run
// against every user at once.
export const SEEDED_SYSTEM_FILLS: Record<string, string> = {
  class: "#a855f7",
  study: "#f59e0b",
  meetings: "#3b82f6",
  personal: "#10b981",
};

// Guard against a palette edit silently stranding one of these on a hex the
// color picker no longer offers: a category whose color isn't in PALETTE reads
// back as null (normalizeFill) and renders as the neutral grey. Cheap to check
// at module load, and the unit test asserts it too.
if (process.env.NODE_ENV !== "production") {
  for (const c of DEFAULT_CATEGORIES) {
    if (!PALETTE.some((p) => p.fill === c.color)) {
      throw new Error(
        `DEFAULT_CATEGORIES: "${c.name}" uses ${c.color}, which is not a PALETTE fill`
      );
    }
  }
}
