// Shared habit constants. Deliberately dependency-free so both the server
// action and the client UI can import it — the cap has to be enforced on the
// server, but the UI needs the same number to disable "add" *before* someone
// hits a rejection they didn't see coming.

// Most active (non-archived) habits one user may have.
//
// This is a feed-noise control as much as a product limit: every check-off
// posts its own card, so the cap is what bounds how many cards one person can
// push into their friends' feeds in a day. Archiving a habit frees a slot.
//
// Safe to introduce at this value — when it was added the largest account had
// 7 active habits, so nobody needed grandfathering.
export const MAX_ACTIVE_HABITS = 8;

// Whether another habit may be created, given how many ACTIVE ones exist.
// Archived habits are excluded by the caller, which is what makes archiving
// free up a slot.
export function canAddHabit(activeCount: number): boolean {
  return activeCount < MAX_ACTIVE_HABITS;
}

// Whether checking off `localDate` should post to friends' feeds.
//
// Only same-day check-offs do. Backfilling a missed day is catch-up
// bookkeeping, and a card announcing "just now" about last Tuesday is both
// confusing and a reward for retroactive checking. Both arguments are
// YYYY-MM-DD in the user's own timezone, so this is a plain string compare —
// no clock, no timezone maths, which is why it's testable at all.
export function shouldPostCheckoffToFeed(
  localDate: string,
  todayInUserTz: string
): boolean {
  return localDate === todayInUserTz;
}
