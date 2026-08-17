import { localNotificationsPlugin } from "@/lib/native-plugins";

// The app's notification permission, in one place.
//
// On iOS local notifications and push share ONE UNUserNotificationCenter
// authorization, and iOS shows its dialog ONCE, EVER. `denied` is terminal —
// asking again displays nothing and returns denied. That single fact is why
// this module exists: the ask is a scarce, unrepeatable resource, and it must
// only ever be spent from a deliberate user gesture with an explanation
// attached.
//
// So the read and the ask are separate functions. Everything that merely wants
// to know the state calls checkNotificationPermission(), which CANNOT prompt.
// Only the three gesture-driven surfaces call requestNotificationPermission().

export type NotifyPermission =
  | "granted"
  | "denied"
  | "prompt"
  // No plugin: the website, or SSR. Deliberately NOT "denied" — one means "we
  // can't ask here", the other "they said no". The UI treats them completely
  // differently, so collapsing them would show a website visitor an "enable
  // notifications in iOS Settings" message.
  | "unavailable";

// The plugin's PermissionState includes 'prompt-with-rationale' (an Android
// concept). Pure and exported so the mapping is unit-testable without a bridge.
export function normalizePermission(display: string): NotifyPermission {
  switch (display) {
    case "granted":
      return "granted";
    case "denied":
      return "denied";
    case "prompt":
    case "prompt-with-rationale":
      return "prompt";
    default:
      return "unavailable";
  }
}

const EVENT = "progra:notification-permission";

// Last known state, so useSyncExternalStore has something synchronous to read.
// null means "not looked yet" — distinct from "unavailable", and what the hook
// renders as "don't show native UI at all".
let cached: NotifyPermission | null = null;

function set(next: NotifyPermission): NotifyPermission {
  if (cached !== next) {
    cached = next;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVENT));
    }
  }
  return next;
}

export function notificationPermissionSnapshot(): NotifyPermission | null {
  return cached;
}

export function subscribeNotificationPermission(
  onChange: () => void
): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

// PURE READ. Never prompts, so it is safe to call on every mount, from an
// effect, on visibilitychange — anywhere. This is the function that replaced
// canScheduleReminders(), which DID prompt and was being called from the root
// layout's sync leaf and the live timer with no user gesture at all: the app
// was spending its one-shot dialog on people who had never been told what it
// was for.
export async function checkNotificationPermission(): Promise<NotifyPermission> {
  const ln = localNotificationsPlugin();
  if (!ln) return set("unavailable");
  try {
    const { display } = await ln.checkPermissions();
    return set(normalizePermission(display));
  } catch {
    return set("unavailable");
  }
}

// PROMPTS. Call ONLY from inside a user gesture.
//
// Legal callers — keep this list current, there is no lint rule that can:
//   1. the onboarding "Enable notifications" CTA  (onboarding-client-v2.tsx)
//   2. the Settings → Notifications row           (settings-client.tsx)
//   3. the live timer's "Turn on reminders" line  (reminders-band.tsx)
//
// Checks first and returns early unless the state is `prompt`. Without that, a
// stray call on an already-denied device resolves to "denied" having shown
// nothing — indistinguishable from the user actively declining, which would
// make the UI report a fresh refusal that never happened.
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  const ln = localNotificationsPlugin();
  if (!ln) return set("unavailable");

  const current = await checkNotificationPermission();
  if (current !== "prompt") return current;

  try {
    const { display } = await ln.requestPermissions();
    return set(normalizePermission(display));
  } catch {
    return set("unavailable");
  }
}

// Open iOS Settings on the Progra page — the ONLY cure for `denied`.
//
// Not App.openUrl(): @capacitor/app v8 has no such method (it exposes exitApp,
// getInfo, getState, getLaunchUrl, getAppLanguage, minimizeApp,
// toggleBackButtonHandler, addListener, removeAllListeners — that's all).
// Navigating the webview to the scheme lets Capacitor's navigation handler pass
// it to UIApplication.open, the same path that makes tel: and mailto: work.
export function openNotificationSettings(): void {
  if (typeof window === "undefined") return;
  window.location.href = "app-settings:";
}
