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