"use client";

import { useEffect } from "react";

import { saveDeviceToken } from "@/app/actions/device-tokens";
import { pushNotificationsPlugin } from "@/lib/native-plugins";
import { useNotificationPermission } from "@/lib/use-notification-permission";

// Registers this device for push, and NEVER asks for permission.
//
// It used to call requestPermissions() on app load, for every signed-in user —
// spending iOS's one-shot notification dialog on push, which has no sender and
// delivers nothing, before the user had been told what it was for. iOS asks
// once ever, so anyone who declined lost the clock reminders too. Now it waits
// until permission is ALREADY granted by one of the three surfaces that explain
// themselves first (onboarding, Settings, the live timer).
//
// It also used to `await import("@capacitor/push-notifications")`, the form
// proven not to settle on device — so everything below that line, including the
// prompt, most likely never ran at all. That is the leading explanation for why
// push registration has never once succeeded. The plugin now comes off the
// Capacitor global; see lib/native-plugins.ts.
//
// The sender is lib/push/send-social-push.ts (likes/comments). Registration
// must still never be the thing that asks for permission.
//
// Mounted only for signed-in users — saveDeviceToken stores the token against
// the current user, so registering while signed out would just fail auth.
export function PushRegistration() {
  const permission = useNotificationPermission();

  useEffect(() => {
    // Keyed on the permission store rather than run-once, so a grant made in
    // onboarding or Settings registers this device in the SAME app session,
    // with no reload.
    if (permission !== "granted") return;

    const pn = pushNotificationsPlugin();
    if (!pn) return;

    let cancelled = false;
    const handles: Array<{ remove: () => void }> = [];

    (async () => {
      // Listeners first: `register()` fires `registration` asynchronously, and
      // attaching afterwards can miss it.
      const onToken = await pn.addListener("registration", (token) => {
        if (cancelled) return;
        saveDeviceToken(token.value)
          .then((r) => {
            if ("error" in r) {
              // Silent for the user — a push token they never asked about
              // isn't worth a toast. Retries on the next app load.
              console.error("saveDeviceToken failed:", r.error);
            }
          })
          // The outer .catch() below can NOT catch this: the plugin invokes
          // this callback later, outside that await chain. saveDeviceToken has
          // no try/catch, so an auth/network failure or the RPC's own `raise
          // exception` rejects here — otherwise an unhandled rejection.
          .catch((err) => {
            console.error("saveDeviceToken threw:", err);
          });
      });
      handles.push(onToken);

      const onError = await pn.addListener("registrationError", (err) => {
        // `err` is {error: string}; logging the object alone prints [object
        // Object] in some webviews, so surface the message too.
        console.error("Push registration error:", err?.error ?? err, err);
      });
      handles.push(onError);

      // Tap-to-route lives in components/notification-tap-router.tsx (one
      // routing component for every notification family); foreground display
      // is native via capacitor.config presentationOptions. Nothing to attach
      // here — this component only registers.

      if (cancelled) {
        handles.forEach((h) => h.remove());
        return;
      }

      // Safe without a permission call of its own: we only get here on
      // "granted", and register() after a denial would just produce a
      // registrationError.
      await pn.register();
    })().catch((err) => {
      console.error("Push setup failed:", err);
    });

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, [permission]);

  return null;
}
