import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Prevent Turbopack from trying to bundle native-only Capacitor packages
  serverExternalPackages: [
    '@capacitor-community/admob',
    '@capacitor/android',
    '@capacitor/splash-screen',
    '@capacitor/status-bar',
  ],
};

export default nextConfig;
