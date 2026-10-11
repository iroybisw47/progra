// The dev-only screenshot harness for the Settings UW block
// (app/dev/uw-settings): which fixture a URL asks for, the saved profile each
// fixture stands for, and a fake setUwProfile. Nothing here reaches a
// database or the network. Only that route imports it, and the route 404s in
// production.
//
// The fake save stores what the real one would: the input goes through the
// real uwProfilePayload, and what the preview then holds is read back off
// that payload, as the page would read the row after revalidating. So a
// screenshot of a Save shows the columns a real one would write.

import { PREVIEW_LATENCY_MS } from "@/lib/onboarding-v3-preview";
import { uwProfilePayload, type UwProfileInput, type UwProfilePayload } from "@/lib/uw";
import type { SavedUw } from "@/lib/uw-fields";

// member    in the cohort and listed: two majors, three interests
// unlisted  in the cohort, never turned the listing on (D2's default)
// new       not in the cohort: switching UW on shows empty fields, unlisted
export const UW_SETTINGS_FIXTURES = ["member", "unlisted", "new"] as const;
export type UwSettingsFixture = (typeof UW_SETTINGS_FIXTURES)[number];

const SAVED: Record<UwSettingsFixture, SavedUw> = {
  member: {
    isUw: true,
    majors: ["Economics", "Computer Science"],
    interests: ["Startups", "Running", "AI"],
    listed: true,
  },
  unlisted: {
    isUw: true,
    majors: ["Informatics"],
    interests: ["Design", "Climbing"],
    listed: false,
  },
  new: { isUw: false, majors: [], interests: [], listed: false },
};

export function uwSettingsSaved(fixture: UwSettingsFixture): SavedUw {
  return SAVED[fixture];
}

type Params = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// `?fixture=<one of UW_SETTINGS_FIXTURES>&save=fail`. An unknown fixture is
// "member", rather than an error, since this is a tool for taking pictures.
// `save=fail` makes every Save answer setUwProfile's error, so the toast and
// the sheet staying open can be seen.
export function parseUwSettingsParams(params: Params): {
  fixture: UwSettingsFixture;
  fail: boolean;
} {
  const raw = first(params.fixture);
  const fixture = (UW_SETTINGS_FIXTURES as readonly string[]).includes(raw ?? "")
    ? (raw as UwSettingsFixture)
    : "member";
  return { fixture, fail: first(params.save) === "fail" };
}

// The real action's error, word for word (app/actions/uw.ts).
export const PREVIEW_SAVE_ERROR = "Couldn't save your UW details.";

function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// setUwProfile, faked: after `latencyMs`, { ok: true }, or its error when
// `fail`. An input the real action would refuse (no boolean isUw) gets the
// error either way, as it would there.
export function createUwSettingsPreviewSave({
  fail = false,
  latencyMs = PREVIEW_LATENCY_MS,
}: { fail?: boolean; latencyMs?: number } = {}): (
  input: UwProfileInput
) => Promise<{ ok: true } | { error: string }> {
  return (input) =>
    after(
      latencyMs,
      fail || !uwProfilePayload(input) ? { error: PREVIEW_SAVE_ERROR } : { ok: true as const }
    );
}

// What the row holds after a save of `input`, as the page would read it back:
// the payload's columns, with the DB's nulls read as empty lists (as
// app/settings/page.tsx reads them). Null for an input the action refuses.
export function previewStoredRow(input: UwProfileInput): {
  payload: UwProfilePayload;
  saved: SavedUw;
} | null {
  const payload = uwProfilePayload(input);
  if (!payload) return null;
  return {
    payload,
    saved: {
      isUw: payload.is_uw,
      majors: payload.uw_majors ?? [],
      interests: payload.uw_interests ?? [],
      listed: payload.uw_listed,
    },
  };
}
