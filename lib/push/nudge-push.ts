import type { NudgeTargetKind } from "@/lib/social/nudges";

// WHAT a nudge push says and where a tap lands — pure, so the copy is testable
// without touching APNs. Mirrors lib/push/social-push.ts; the orchestrator
// (lib/push/send-nudge-push.ts) consumes this and lib/push/apns.ts sends it.
//
// The body is SYSTEM-GENERATED. The preset the sender picked is shown only
// in-app, so a lock screen can never carry text chosen by another user — a
// stricter rule than the comment push, which does include the comment.

export type NudgePushInput =
  | {
      mode: "single";
      // display_name ?? username ?? fallback — resolved by the caller.
      senderName: string;
      targetKind: NudgeTargetKind;
      // Goal title, or "Habits". Snapshotted on the nudge row, so it survives
      // the goal being renamed or deleted.
      targetLabel: string;
      // Null once the goal is gone (ON DELETE SET NULL) — the deep link then
      // falls back to the clock picker.
      goalId: string | null;
    }
  | { mode: "coalesced"; senderName: string; othersCount: number };

export type NudgePushContent = {
  title: string;
  body: string;
  // In-app path a tap navigates to; rides in the push payload and is followed
  // by components/notification-tap-router.tsx.
  url: string;
};

// A push line, not a paragraph. Goal titles are free text and can be long.
const LABEL_MAX = 60;

export function nudgeLabelSnippet(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= LABEL_MAX) return trimmed;
  return `${trimmed.slice(0, LABEL_MAX - 1).trimEnd()}…`;
}

export function composeNudgePush(input: NudgePushInput): NudgePushContent {
  if (input.mode === "coalesced") {
    const others =
      input.othersCount === 1 ? "1 other" : `${input.othersCount} others`;
    return {
      title: `${input.senderName} and ${others}`,
      body: "nudged you to lock in.",
      url: "/clock",
    };
  }

  if (input.targetKind === "habits") {
    return {
      title: input.senderName,
      body: "nudged you to finish your habits.",
      url: "/",
    };
  }

  return {
    title: input.senderName,
    body: `nudged you to lock in on ${nudgeLabelSnippet(input.targetLabel)}.`,
    // /clock pre-selects this goal in the clock-in picker, and ignores an id
    // that is no longer one of the user's active goals.
    url: input.goalId === null ? "/clock" : `/clock?goal=${input.goalId}`,
  };
}

// The push_log primary key. Per NUDGE, not per pair: the 6-hour cooldown
// already bounds how often one person can send, so every nudge that reaches
// the sender is a genuine new event and may push at most once.
export function nudgeDedupeKey(nudgeId: string): string {
  return `nudge:${nudgeId}`;
}

// apns-collapse-id: every nudge in one 60-minute window shares the anchor's id,
// so a later, sound-less push REPLACES the banner instead of stacking a second
// buzz. Must be <= 64 bytes; "nudge-" + a uuid is 42.
export function nudgeCollapseId(anchorNudgeId: string): string {
  return `nudge-${anchorNudgeId}`;
}
