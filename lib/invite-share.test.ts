import { describe, expect, it } from "vitest";

import { APP_STORE_URL } from "@/lib/app-store";
import {
  ACCOUNTABILITY_INVITE_TEXT,
  DEFAULT_INVITE_TEXT,
  inviteBody,
} from "@/lib/invite-share";

// inviteBody is the only pure part of invite-share (copy/share need navigator).
// It's also the part that decides what every invite hands out, so it's the part
// worth pinning.
describe("inviteBody", () => {
  it("is the message and the link, newline-separated", () => {
    expect(inviteBody("hello")).toBe(`hello\n${APP_STORE_URL}`);
  });

  // The whole point of the 2026-09-17 switch: no share path may hand out the
  // website any more.
  it("never hands out a progra.world link", () => {
    expect(inviteBody(DEFAULT_INVITE_TEXT)).not.toContain("progra.world");
  });
});

describe("ACCOUNTABILITY_INVITE_TEXT", () => {
  // It deliberately trails off into the link on the next line. A trailing
  // period or the link inlined would both break that reading.
  it("runs straight into the link", () => {
    expect(inviteBody(ACCOUNTABILITY_INVITE_TEXT)).toBe(
      `I'm getting 1% better every day on Progra, and I need you to hold me accountable! Join me at\n${APP_STORE_URL}`
    );
  });
});

describe("APP_STORE_URL", () => {
  // A /xx/ segment pins one storefront and walls the listing off from accounts
  // registered in any other country.
  it("is storefront-neutral", () => {
    expect(APP_STORE_URL).not.toMatch(/apps\.apple\.com\/[a-z]{2}\//);
  });

  // The one typo that would silently break every invite at once.
  it("carries the real app id", () => {
    expect(APP_STORE_URL).toContain("id6798377328");
  });
});
