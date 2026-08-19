import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'world.progra.app',
  appName: 'Progra',
  webDir: 'public',
  server: {
    url: 'https://progra.world',
    cleartext: false,
  },
  ios: {
    // Capacitor's own default, restored. With 'automatic', UIKit adds the safe
    // areas to the web view's scroll view as a CONTENT INSET — real scrollable
    // space, not a bounce (CAPBridgeViewController.swift:301 sets
    // `scrollView.bounces = false`, so the document never rubber-bands). On top
    // of that the CSS already insets the app itself
    // (`body { padding-top: env(safe-area-inset-top) }` in globals.css), so the
    // screen was inset twice and you could scroll up into the gap above the
    // header. 'never' hands the job back to the CSS, which is what
    // `viewport-fit=cover` + the black-translucent status bar were written for.
    contentInset: 'never',
    // Without this, CAPBridgeViewController assigns UIColor.systemBackground to
    // BOTH the webview and its scroll view (CAPBridgeViewController.swift:308-314),
    // and since Info.plist declares no UIUserInterfaceStyle the app follows the
    // system appearance — so on a phone in dark mode that colour is black. The
    // scroll view's background is what shows while rubber-banding past the end of
    // a list, which is the black space users reported. The page itself is always
    // light (Progra has no dark mode), so the webview backdrop should be too.
    backgroundColor: '#ffffff',
  },
  plugins: {
    PushNotifications: {
      // Without this the plugin's willPresent returns [] and a push that
      // arrives while the app is OPEN shows nothing at all. The JS
      // `pushNotificationReceived` listener still fires either way — only the
      // banner depends on this. Native config: needs `npx cap sync ios`.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;