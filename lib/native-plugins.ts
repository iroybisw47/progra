import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";
import type { PushNotificationsPlugin } from "@capacitor/push-notifications";

import type { LiveActivitySnapshot } from "@/lib/live-activity";

// Every Capacitor plugin this app touches, read off the Capacitor global.
//
// DO NOT IMPORT A CAPACITOR PLUGIN. Both forms fail on device: `await
// import(...)` never settles, and a static import stalled too — impossible for
// a synchronous body in an async wrapper, which is how we know the bundler is
// doing something unexplained. Root cause was never established. What IS
// proven, from the Safari inspector on the device, is that
// window.Capacitor.Plugins.LocalNotifications reports display=granted, accepts
// a schedule and delivers the banner. Capacitor registers plugins on that
// global at bridge startup, so there's no module resolution and no chunk fetch
// that can be left pending.
//
// This module therefore has ZERO runtime imports — the two above are `import
// type`, erased at build time. There is nothing here for the bundler to defer.
//
// Every accessor is SYNCHRONOUS on purpose: a promise-returning accessor is
// what let the original stall hide as a pending await through three rounds of
// debugging. Off-native (the website, SSR) the global is absent and these
// return null, so callers get the same "no plugin, do nothing" contract
// everywhere.
//
// To be precise, since the rule is easy to over-read: it's the ACCESSORS that
// must be synchronous, not the plugin methods. `ln.schedule()` is already
// awaited and so is `la.sync()`. The original stall hid inside a
// promise-returning accessor, where there was no plugin reference to inspect —
// a different thing from awaiting a call on a reference you already hold.

// Progra's own Live Activity plugin. Its interface is HAND-WRITTEN because there
// is no npm package to `import type` from — it's a CAPPlugin subclass compiled
// into the app target, which Capacitor discovers from the Objective-C runtime and
// registers on the global like any other. Only the payload type is imported, and
// that import is erased (see above).
//
// ONE `sync` method, not start/update — and that is not stylistic. TypeScript
// cannot know whether an activity exists, because iOS ends them on its own: the
// ~8h lifetime limit, the user switching Live Activities off, force-quit cleanup.
// A TS-side "did we start it" boolean would be wrong after every one of those,
// and the sharp case is real — pause at hour 7, resume at hour 12, and `update()`
// fails on a dismissed activity where `request()` is needed. Swift inspects
// Activity.activities and decides. `null` means end whatever is showing.
type LiveActivityPlugin = {
  sync(options: { snapshot: LiveActivitySnapshot | null }): Promise<void>;
};

// @capacitor/app, for deep links. Note the two sources: `appUrlOpen` fires on a
// WARM open, and getLaunchUrl() covers the COLD one, where the URL exists before
// any JS is listening. Capacitor does NOT navigate the webview on a custom-scheme
// open — it only fires this event — so without a listener a deep link does
// nothing but foreground the app.
//
// `pause` / `resume` are the events that mean "went to the background" and
// "came back": on iOS they map to didEnterBackground / willEnterForeground.
// NOT `appStateChange`, which also fires for Control Center, the notification
// shade and an incoming call — none of which is the user leaving the app.
// `getInfo()` is the only way JS can learn the native build it is running in.
type AppPlugin = {
  addListener(
    event: "appUrlOpen",
    cb: (data: { url: string }) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    event: "pause" | "resume",
    cb: () => void
  ): Promise<{ remove: () => void }>;
  getLaunchUrl(): Promise<{ url: string } | null>;
  getInfo(): Promise<{ name: string; id: string; build: string; version: string }>;
};

type Plugins = {
  LocalNotifications?: LocalNotificationsPlugin;
  PushNotifications?: PushNotificationsPlugin;
  PrograLiveActivity?: LiveActivityPlugin;
  App?: AppPlugin;
};

// The one place that touches `window.Capacitor`. Returns null off-native, which
// covers SSR and the website — both share this bundle.
function plugins(): Plugins | null {
  if (typeof window === "undefined") return null;
  const cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: Plugins;
      };
    }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins ?? null;
}

export function localNotificationsPlugin(): LocalNotificationsPlugin | null {
  return plugins()?.LocalNotifications ?? null;
}

export function pushNotificationsPlugin(): PushNotificationsPlugin | null {
  return plugins()?.PushNotifications ?? null;
}

// Null on web, AND on any binary that predates the plugin — which is the normal
// case for a while, since the JS deploys from Vercel while the binary waits on
// App Store review. Callers treat it as "no plugin, do nothing", same contract
// as the two above.
export function liveActivityPlugin(): LiveActivityPlugin | null {
  return plugins()?.PrograLiveActivity ?? null;
}

export function appPlugin(): AppPlugin | null {
  return plugins()?.App ?? null;
}
