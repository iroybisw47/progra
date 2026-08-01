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
};

export default config;