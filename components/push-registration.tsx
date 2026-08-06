"use client";

import { useEffect } from "react";

import { saveDeviceToken } from "@/app/actions/device-tokens";
import { isNativeApp } from "@/lib/native";

// Registers this device for push on app load. Native-only: no-op on the
// website, which shares this bundle. Same "client leaf that does nothing until
// it has to" shape as EnsureProfileSync / EnsureSessionCap / NativeAuthListener.
//
// Mounted only for signed-in users — saveDeviceToken stores the token against
// the current user, so registering while signed out would just fail auth. A
// fresh sign-in remounts this and registers then.
//
// Safe to run every load: iOS shows its permission prompt only once (later
// calls report the existing state), and re-registering refreshes updated_at and
// picks up a rotated APNs token.
export function PushRegistration() {
  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;
    const handles: Array<{ remove: () => void }> = [];

    (async () => {
      // Dynamic import keeps the native-only plugin out of the web bundle and
      // off the SSR path.
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      // Listeners first: `register()` fires `registration` asynchronously, and
      // attaching afterwards can miss it.
      const onToken = await PushNotifications.addListener(
        "registration",
        (token) => {
          // DEBUG: remove with the rest of the `[push]` logging once delivery
          // is confirmed. Truncated — a device token is a credential.
          console.log(
            "[push] registration ok, token:",
            `${token.value.slice(0, 12)}…(${token.value.length} chars)`
          );
          if (cancelled) return;
          saveDeviceToken(token.value)
            .then((r) => {
              if ("error" in r) {
                // Silent for the user — a push token they never asked about
                // isn't worth a toast. Retries on the next app load.
                console.error("saveDeviceToken failed:", r.error);
              } else {
                console.log("[push] token saved"); // DEBUG
              }
            })
            // The outer .catch() below can NOT catch this: the plugin invokes
            // this callback later, outside that await chain. saveDeviceToken
            // has no try/catch, so an auth/network failure or the RPC's own
            // `raise exception` rejects here — previously an unhandled rejection.
            .catch((err) => {
              console.error("saveDeviceToken threw:", err);
            });
        }
      );
      handles.push(onToken);

      const onError = await PushNotifications.addListener(
        "registrationError",
        (err) => {
          // `err` is {error: string}; logging the object alone prints [object
          // Object] in some webviews, so surface the message too.
          console.error("Push registration error:", err?.error ?? err, err);
        }
      );
      handles.push(onError);

      // DEBUG: both of these exist purely so a simulator/device test can prove
      // a delivered push reached JS, not just the OS banner. Logging only —
      // deliberately no routing (see the plan: tap-to-route is a feature).
      const onReceived = await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          // Fires for foreground pushes. Note this runs BEFORE the plugin
          // consults `presentationOptions`, so it logs even when no banner shows.
          console.log("[push] received (foreground):", notification);
        }
      );
      handles.push(onReceived);

      const onAction = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          console.log("[push] tapped:", action);
        }
      );
      handles.push(onAction);

      if (cancelled) {
        handles.forEach((h) => h.remove());
        return;
      }

      // Prompt, then register only on an explicit grant — calling register()
      // after a denial just produces a registrationError.
      const perm = await PushNotifications.requestPermissions();
      console.log("[push] permission:", perm.receive); // DEBUG
      if (cancelled || perm.receive !== "granted") return;
      await PushNotifications.register();
      // DEBUG: this resolving proves nothing on its own — it returned fine even
      // when the AppDelegate was dropping every token. Wait for `registration`.
      console.log("[push] register() called, awaiting `registration` event…");
    })().catch((err) => {
      console.error("Push setup failed:", err);
    });

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, []);

  return null;
}
