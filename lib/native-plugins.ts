import type { LocalNotificationsPlugin } from "@capacitor/local-notifications";
import type { PushNotificationsPlugin } from "@capacitor/push-notifications";

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

type Plugins = {
  LocalNotifications?: LocalNotificationsPlugin;
  PushNotifications?: PushNotificationsPlugin;
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
