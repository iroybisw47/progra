// Streaks: the knobs, in one place (.claude/plans/streaks.md).
//
// The rules that use them live in lib/streaks.ts and are mirrored in SQL
// (.claude/plans/streaks.sql). The SQL carries its own copies of these numbers
// as literals, and the PGlite harness (nudges-harness/streaks.mjs) runs the
// same fixtures through both, so a change here that isn't made there fails the
// harness rather than drifting quietly.

// Day One: the first streak day that counts, as YYYY-MM-DD in each user's own
// timezone, from 04:00 local (STREAK_CUTOFF_HOUR). null = not decided yet,
// which every surface reads as "pre-launch": the announcement, no numbers.
//
// The database's streak_config.launch_date is the authority for counting
// (the server decides); this mirrors it for copy. Change the two together, and
// change the announcement copy with them.
export const STREAK_LAUNCH_DATE: string | null = "2026-10-21";

// A streak day runs from 04:00 to 04:00 local, so a 1am session still belongs
// to the evening before it.
export const STREAK_CUTOFF_HOUR = 4;

// A session counts when it has at least this much worked time (pauses out,
// auto-ended sessions are 0; lib/session.ts sessionWorkedMs).
export const STREAK_MIN_WORKED_MS = 5 * 60_000;

// Free for everyone, per calendar month, no carry-over.
export const FREEZES_PER_MONTH = 2;

// The personal reminder: local hour it goes out, and the smallest streak
// worth reminding about.
export const STREAK_REMINDER_HOUR = 19;
export const STREAK_REMINDER_MIN = 3;

// Quiet badges at these lengths. No celebration screen.
export const STREAK_MILESTONES = [7, 30, 100] as const;

// A friend's streak shows on their profile from this length.
export const FRIEND_STREAK_MIN = 2;

// The announcement card's words, approved by the owner 2026-10-20. Read before
// and after Day One alike (the card adds its own "Starts …, from 4am" line
// before), so they must work both ways. A placeholder containing
// ANNOUNCEMENT_PLACEHOLDER never renders in production (announcementFor).
// Change it with the launch date.
export const STREAK_ANNOUNCEMENT_COPY = {
  title: "Introducing streaks",
  body: "Clock in for 5 minutes or check off one habit each day to keep your streak going. Two freezes a month cover the days you miss.",
} as const;
