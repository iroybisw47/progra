// Shared bug-report constants/types. Kept out of the "use server" action file
// (which may only export async functions) so the action, the sheet, and the
// admin panel all agree on the allowed values. The DB CHECK constraints enforce
// the same sets.

export const BUG_DESCRIPTION_MAX = 1000;

// Diagnostic context is stored as free text, but capped so a hostile client
// can't post a megabyte of user-agent. These are generous — real values are an
// order of magnitude shorter.
export const BUG_ROUTE_MAX = 200;
export const BUG_USER_AGENT_MAX = 400;
export const BUG_VIEWPORT_MAX = 20;

export const BUG_STATUSES = ["open", "resolved", "dismissed"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function isBugStatus(v: string): v is BugStatus {
  return (BUG_STATUSES as readonly string[]).includes(v);
}

export const BUG_PLATFORMS = ["native", "web"] as const;
export type BugPlatform = (typeof BUG_PLATFORMS)[number];

export function isBugPlatform(v: string): v is BugPlatform {
  return (BUG_PLATFORMS as readonly string[]).includes(v);
}
