import { describe, expect, it } from "vitest";

import { isJohnUser, johnCohortBit } from "@/lib/john/cohort";
import {
  FOCUS_RATINGS,
  INTENTION_MAX,
  MISS_REASONS,
  MISS_REASON_LABELS,
  OUTCOME_MAX,
  PHONE_LEVELS,
  PHONE_LEVEL_LABELS,
  TARGET_OUTCOME_MAX,
  isFocusRating,
  isMissReason,
  isPhoneLevel,
} from "@/lib/john/instrumentation";

// Each of these literals is a SECOND COPY of a DB CHECK constraint, on purpose:
// edit one side and this fails loudly in CI, instead of the insert failing in
// production for the two people in the cohort.
describe("value sets match the SQL CHECK constraints", () => {
  it("phone_distraction", () => {
    expect(PHONE_LEVELS).toEqual(["none", "a_few", "a_lot"]);
  });

  it("habit_misses.reason", () => {
    expect(MISS_REASONS).toEqual(["busy", "tired", "forgot", "didnt_feel_like_it"]);
  });

  it("focus_rating spans exactly 1..5", () => {
    expect(FOCUS_RATINGS).toEqual([1, 2, 3, 4, 5]);
  });

  it("text caps match sessions_intention_len / _outcome_len / goals_target_outcome_len", () => {
    expect([INTENTION_MAX, OUTCOME_MAX, TARGET_OUTCOME_MAX]).toEqual([140, 140, 200]);
  });

  // A reason key containing an apostrophe would need escaping everywhere it is
  // interpolated into SQL. Keeping the punctuation in the LABEL instead is what
  // makes that a non-issue — this pins it.
  it("no key needs SQL escaping", () => {
    for (const key of [...MISS_REASONS, ...PHONE_LEVELS]) {
      expect(key).toMatch(/^[a-z_]+$/);
    }
  });
});

describe("guards reject what the database would", () => {
  it("isFocusRating refuses 0 and 6, the two the CHECK rejects", () => {
    expect(isFocusRating(0)).toBe(false);
    expect(isFocusRating(6)).toBe(false);
    expect(isFocusRating(1)).toBe(true);
    expect(isFocusRating(5)).toBe(true);
  });

  // A client could post 3.5 or "3"; the smallint column would reject one and
  // silently coerce the other.
  it("isFocusRating refuses non-integers and strings", () => {
    expect(isFocusRating(3.5)).toBe(false);
    expect(isFocusRating("3")).toBe(false);
    expect(isFocusRating(null)).toBe(false);
  });

  it("isPhoneLevel refuses a plausible-but-absent value", () => {
    expect(isPhoneLevel("sometimes")).toBe(false);
    expect(isPhoneLevel("a_few")).toBe(true);
  });

  it("isMissReason refuses a plausible-but-absent value", () => {
    expect(isMissReason("lazy")).toBe(false);
    expect(isMissReason("didnt_feel_like_it")).toBe(true);
  });
});

describe("labels", () => {
  it("every key has one, so the UI can never render a raw key", () => {
    for (const r of MISS_REASONS) expect(MISS_REASON_LABELS[r]).toBeTruthy();
    for (const p of PHONE_LEVELS) expect(PHONE_LEVEL_LABELS[p]).toBeTruthy();
  });
});

describe("cohort gate", () => {
  // The polarity that matters. Before the column SQL ran, PostgREST omitted the
  // key entirely — so `undefined` MUST read as "not in the test". Getting this
  // backwards shows the new UI to all ~50 beta users.
  it("fails closed on a missing key, a null, and a null profile", () => {
    expect(johnCohortBit({})).toBe(false);
    expect(johnCohortBit({ john_enabled: null })).toBe(false);
    expect(johnCohortBit(null)).toBe(false);
    expect(johnCohortBit(undefined)).toBe(false);
  });

  it("is true only for an explicit true", () => {
    expect(johnCohortBit({ john_enabled: true })).toBe(true);
    expect(johnCohortBit({ john_enabled: false })).toBe(false);
  });

  // NEXT_PUBLIC_JOHN is unset in the test environment, so this pins the kill
  // switch: with the flag off, nobody is in the cohort however the column reads.
  it("the build flag overrides the column", () => {
    expect(isJohnUser({ john_enabled: true })).toBe(false);
  });
});
