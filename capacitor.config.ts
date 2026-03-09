import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.impact.idlegame',
  appName: 'Impact',
  webDir: 'out', // Next.js static export output
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
    },
  },
  // iOS specific settings
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  // Android specific settings
  android: {
    backgroundColor: '#0a0a1a',
    allowMixedContent: false,
  },
};

export default config;
