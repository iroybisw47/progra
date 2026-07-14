import { describe, expect, it } from "vitest";

import { checkUsername, normalizeUsername } from "@/lib/social/username";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Tapa  ")).toBe("tapa");
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
