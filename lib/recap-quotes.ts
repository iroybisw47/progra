// The weekly review's closing quote (RECAP_V2, the Closing slide).
//
// THE LIST IS THE SCHEDULE. Entry 0 belongs to the week of QUOTES_START_WEEK,
// entry 1 to the week after, and so on, wrapping when the list runs out. Append
// to add the next weeks' quotes; reordering moves every later week.
//
// The owner chose the first one (2026-10-11) and supplies the rest.

export type RecapQuote = { text: string; author: string };

export const QUOTES_START_WEEK = "2026-10-05";

export const RECAP_QUOTES: readonly RecapQuote[] = [
  {
    text: "Opportunity is missed by most because it comes dressed in overalls and looks like work.",
    author: "Thomas Edison",
  },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function utcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// The quote for the week starting on `weekStartISO` (a YYYY-MM-DD Monday).
// Weeks before the start count backwards through the list, so any week has one.
export function quoteForWeek(
  weekStartISO: string,
  quotes: readonly RecapQuote[] = RECAP_QUOTES
): RecapQuote {
  const weeks = Math.round((utcMs(weekStartISO) - utcMs(QUOTES_START_WEEK)) / WEEK_MS);
  const n = quotes.length;
  return quotes[((weeks % n) + n) % n];
}
