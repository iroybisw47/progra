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
    contentInset: 'automatic',
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