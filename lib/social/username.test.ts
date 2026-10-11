import { describe, expect, it } from "vitest";

import {
  SEARCH_QUERY_MIN,
  SEARCH_RESULTS_MAX,
  checkUsername,
  normalizeSearchQuery,
  normalizeUsername,
  orderSearchMatches,
} from "@/lib/social/username";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Tapa  ")).toBe("tapa");
  });
});

describe("normalizeSearchQuery", () => {
  // The app writes handles as "@maya", so that is what people type.
  it("drops a leading @ and normalizes like a handle", () => {
    expect(normalizeSearchQuery("@Maya")).toBe("maya");
    expect(normalizeSearchQuery("  @maya  ")).toBe("maya");
    expect(normalizeSearchQuery("maya")).toBe("maya");
  });

  it("drops a run of @s and the space after them", () => {
    expect(normalizeSearchQuery("@@maya")).toBe("maya");
    expect(normalizeSearchQuery("@ maya")).toBe("maya");
  });

  // Only LEADING: an @ elsewhere is left for the RPC, where it simply matches
  // nothing (no handle can hold one).
  it("leaves an @ that isn't leading", () => {
    expect(normalizeSearchQuery("ma@ya")).toBe("ma@ya");
  });

  // The minimum is measured after the strip, so "@m" is too short to send.
  it("can leave a query under the minimum", () => {
    expect(normalizeSearchQuery("@").length).toBe(0);
    expect(normalizeSearchQuery("@m").length).toBeLessThan(SEARCH_QUERY_MIN);
    expect(normalizeSearchQuery("@ma").length).toBe(SEARCH_QUERY_MIN);
  });

  it("caps results at the redesign's five", () => {
    expect(SEARCH_RESULTS_MAX).toBe(5);
  });
});

describe("orderSearchMatches", () => {
  const row = (username: string | null, name = "") => ({ username, name });

  // The case that matters: five display-name matches ahead of the exact
  // handle, so a plain slice(0, 5) would drop @sam.
  it("keeps the exact handle inside the cap", () => {
    const rows = [
      row("alee", "Sam Lee"),
      row("bsmith", "Sam Smith"),
      row("cj", "Samantha J"),
      row("dk", "Sami K"),
      row("ef", "Samir F"),
      row("sam"),
    ];
    const top = orderSearchMatches(rows, "sam").slice(0, SEARCH_RESULTS_MAX);
    expect(top[0].username).toBe("sam");
  });

  it("orders exact, then handle prefix, then the rest, stably", () => {
    const rows = [
      row("zed", "Sam Z"),
      row("samuel"),
      row("asam"),
      row("sam"),
      row("sammy"),
      row(null, "Sam N"),
    ];
    expect(orderSearchMatches(rows, "sam").map((r) => r.username)).toEqual([
      "sam",
      "samuel",
      "sammy",
      "zed",
      "asam",
      null,
    ]);
  });

  it("does not mutate its input", () => {
    const rows = [row("zed"), row("sam")];
    orderSearchMatches(rows, "sam");
    expect(rows.map((r) => r.username)).toEqual(["zed", "sam"]);
  });
});

describe("checkUsername", () => {
  it("accepts a normal handle", () => {
    const r = checkUsername("tapa_23");
    expect(r).toEqual({ ok: true, username: "tapa_23" });
  });

  it("normalizes mixed case and surrounding space", () => {
    const r = checkUsername("  DeepWork  ");
    expect(r).toEqual({ ok: true, username: "deepwork" });
  });

  it("rejects too short", () => {
    expect(checkUsername("ab").ok).toBe(false);
  });

  it("rejects too long", () => {
    expect(checkUsername("a".repeat(21)).ok).toBe(false);
  });

  it("rejects disallowed characters", () => {
    expect(checkUsername("bad name").ok).toBe(false);
    expect(checkUsername("no-hyphens").ok).toBe(false);
    expect(checkUsername("emoji😀ok").ok).toBe(false);
  });

  it("rejects an all-numeric / no-letter handle", () => {
    expect(checkUsername("12345").ok).toBe(false);
    expect(checkUsername("1_2_3").ok).toBe(false);
  });

  it("rejects leading/trailing underscores", () => {
    expect(checkUsername("_tapa").ok).toBe(false);
    expect(checkUsername("tapa_").ok).toBe(false);
  });

  it("rejects reserved words", () => {
    expect(checkUsername("admin").ok).toBe(false);
    expect(checkUsername("Progra").ok).toBe(false); // case-insensitive
    expect(checkUsername("profile").ok).toBe(false);
  });
});
