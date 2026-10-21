import { setStatusBarText, type StatusBarText } from "@/lib/status-bar";

// Light or dark, on THIS device (design_handoff_dark_mode §4.4).
//
// Per-device rather than an account setting, like lib/habit-reminder-prefs.ts:
// it's a statement about this phone (whose system appearance "System" follows),
// so there's no column, no server action and nothing threaded through the root
// layout's data fetch. The default — unset, garbage, storage unavailable — is
// "system".
//
// The theme itself is one class, `.dark` on <html>, which swaps every token in
// app/globals.css. It goes on <html> and nowhere else: --cat-* and --chart-*
// are declared on :root as var(--palette-N) and only resolve to the dark
// palette when the class is on that same element.

export type AppearancePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const APPEARANCE_KEY = "progra.appearance";
const EVENT = "progra:appearance";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// The browser chrome's color for each theme: the screen ground.
export const THEME_COLOR: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#14181f",
};

// PURE, so the decision is testable without a browser.
export function appearancePrefFor(stored: string | null): AppearancePref {
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveTheme(pref: AppearancePref, systemDark: boolean): Theme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

// The status bar's text for a theme. "System" leaves it on "default", which
// iOS already resolves from the phone's appearance — the same thing the theme
// is following. A manual choice that may disagree with the phone says so.
export function statusBarTextFor(pref: AppearancePref, theme: Theme): StatusBarText {
  if (pref === "system") return "default";
  return theme === "dark" ? "light" : "dark";
}

export function appearancePref(): AppearancePref {
  if (typeof window === "undefined") return "system";
  try {
    return appearancePrefFor(window.localStorage.getItem(APPEARANCE_KEY));
  } catch {
    // Storage throws in private modes.
    return "system";
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

export function currentTheme(): Theme {
  return resolveTheme(appearancePref(), systemPrefersDark());
}

// The app's own status-bar text — what every screen but the recap's navy
// slides runs with, and what the recap hands back on its way out.
export function appStatusBarText(): StatusBarText {
  return statusBarTextFor(appearancePref(), currentTheme());
}

// Puts the device's theme on the page: the class, the browser chrome's
// theme-color, and the iOS status bar. Idempotent, so it's safe to call on
// every change and again after hydration (the head script ran before the
// theme-color metas may have existed).
export function applyAppearance(): void {
  if (typeof document === "undefined") return;
  const pref = appearancePref();
  const theme = resolveTheme(pref, systemPrefersDark());
  document.documentElement.classList.toggle("dark", theme === "dark");
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
  setStatusBarText(statusBarTextFor(pref, theme));
}

export function setAppearancePref(pref: AppearancePref): void {
  if (typeof window === "undefined") return;
  try {
    // Absence means "system", so a fresh device and a device set back to
    // System are the same state.
    if (pref === "system") window.localStorage.removeItem(APPEARANCE_KEY);
    else window.localStorage.setItem(APPEARANCE_KEY, pref);
  } catch {
    // Ignore — the change still applies for this page's lifetime.
  }
  applyAppearance();
  window.dispatchEvent(new Event(EVENT));
}

// Fires on a change of preference (this tab or another) and on the phone's
// own light/dark switch, which only matters while the preference is "system"
// but is cheap to listen to regardless.
export function subscribeAppearance(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia?.(DARK_QUERY);
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  media?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media?.removeEventListener("change", onChange);
  };
}

// Runs in <head> before first paint (app/layout.tsx), so a dark device never
// flashes the light theme on a cold launch. It has to be a string: it executes
// before any bundle has loaded. The same decision as appearancePrefFor +
// resolveTheme, kept in step by lib/appearance.test.ts, which runs it.
export const APPEARANCE_SCRIPT = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(
  APPEARANCE_KEY
)})}catch(e){}var d=p==="dark"||(p!=="light"&&!!window.matchMedia&&matchMedia(${JSON.stringify(
  DARK_QUERY
)}).matches);document.documentElement.classList.toggle("dark",d);var c=d?${JSON.stringify(
  THEME_COLOR.dark
)}:${JSON.stringify(
  THEME_COLOR.light
)};document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}catch(e){}})()`;
