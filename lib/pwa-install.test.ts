import { describe, expect, it } from "vitest";

import { shouldShowIosInstallHint, type InstallHintInput } from "@/lib/pwa-install";

// Representative real-world UA strings.
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const IPHONE_INAPP_FB =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]";

function input(over: Partial<InstallHintInput>): InstallHintInput {
  return {
    userAgent: IPHONE_SAFARI,
    maxTouchPoints: 5,
    navigatorStandalone: false,
    displayModeStandalone: false,
    ...over,
  };
}

describe("shouldShowIosInstallHint", () => {
  it("shows on iPhone Safari, not installed", () => {
    expect(shouldShowIosInstallHint(input({}))).toBe(true);
  });

  it("hidden on iPhone Chrome (CriOS)", () => {
    expect(shouldShowIosInstallHint(input({ userAgent: IPHONE_CHROME }))).toBe(
      false
    );
  });

  it("hidden when already installed (navigator.standalone)", () => {
    expect(
      shouldShowIosInstallHint(input({ navigatorStandalone: true }))
    ).toBe(false);
  });

  it("hidden when already installed (display-mode: standalone)", () => {
    expect(
      shouldShowIosInstallHint(input({ displayModeStandalone: true }))
    ).toBe(false);
  });

  it("shows on iPadOS reporting a desktop UA (touch points > 1)", () => {
    expect(
      shouldShowIosInstallHint(
        input({ userAgent: IPAD_DESKTOP_UA, maxTouchPoints: 5 })
      )
    ).toBe(true);
  });

  it("hidden on real Mac Safari (desktop UA, no touch)", () => {
    expect(
      shouldShowIosInstallHint(
        input({ userAgent: MAC_SAFARI, maxTouchPoints: 0 })
      )
    ).toBe(false);
  });

  it("hidden on Android Chrome", () => {
    expect(
      shouldShowIosInstallHint(input({ userAgent: ANDROID_CHROME }))
    ).toBe(false);
  });

  it("hidden in an iOS in-app webview (Facebook)", () => {
    expect(
      shouldShowIosInstallHint(input({ userAgent: IPHONE_INAPP_FB }))
    ).toBe(false);
  });
});
