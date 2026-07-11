// Decides whether to show the iOS "Add to Home Screen" hint. Pure so the gnarly
// user-agent logic is unit-testable without a real device (see pwa-install.test.ts).
//
// Shows only when ALL hold:
//  - the device is iOS (iPhone/iPad/iPod, incl. iPadOS reporting a desktop UA),
//  - the browser is Safari — not an iOS Chrome/Firefox/Edge/Opera or an in-app
//    webview, none of which expose the Share → Add to Home Screen flow the copy
//    describes,
//  - Progra isn't already running as an installed standalone PWA.

// iOS browsers that are NOT Safari, plus common in-app webviews (Google app,
// Facebook, Instagram, Line). None get the standard Safari A2HS share sheet.
const NON_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line/;

export type InstallHintInput = {
  userAgent: string;
  // iPadOS 13+ reports a macOS UA; a touch count > 1 distinguishes it from a Mac.
  maxTouchPoints: number;
  // iOS Safari's non-standard flag: true when launched from the Home Screen.
  navigatorStandalone: boolean | undefined;
  // matchMedia("(display-mode: standalone)").matches — the cross-browser signal.
  displayModeStandalone: boolean;
};

export function shouldShowIosInstallHint({
  userAgent,
  maxTouchPoints,
  navigatorStandalone,
  displayModeStandalone,
}: InstallHintInput): boolean {
  const isIosDevice = /iPhone|iPad|iPod/.test(userAgent);
  const isIpadDesktopUa = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  const isIos = isIosDevice || isIpadDesktopUa;
  if (!isIos) return false;

  const isSafari =
    /Safari/.test(userAgent) &&
    /Version\//.test(userAgent) &&
    !NON_SAFARI.test(userAgent);
  if (!isSafari) return false;

  const alreadyInstalled = navigatorStandalone === true || displayModeStandalone;
  return !alreadyInstalled;
}
