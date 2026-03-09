/**
 * AdMob Bridge — handles ad initialization and display
 *
 * On web: Uses a simulated placeholder (AdModal component handles this)
 * On native (Capacitor): Will use @capacitor-community/admob for real ads
 *
 * SETUP INSTRUCTIONS:
 * 1. Install: npm install @capacitor-community/admob
 * 2. Replace placeholder AD_UNIT_IDS with real ones from AdMob console
 * 3. Initialize in app startup: await initAdMob()
 * 4. Use showRewardedAd() before granting boost rewards
 */

// Placeholder ad unit IDs — replace with real ones before app store submission
export const AD_UNIT_IDS = {
  ios: {
    rewarded: 'ca-app-pub-XXXXXXXXXX/YYYYYYYYYY', // Replace with real iOS rewarded ad unit ID
  },
  android: {
    rewarded: 'ca-app-pub-XXXXXXXXXX/YYYYYYYYYY', // Replace with real Android rewarded ad unit ID
  },
  // Test IDs for development
  test: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917', // Google test ad unit ID
  },
};

/**
 * Check if running on a native platform via Capacitor
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore - Capacitor may or may not be available
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  // @ts-ignore
  if (window.Capacitor) {
    // @ts-ignore
    const platform = window.Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }
  return 'web';
}

/**
 * Initialize AdMob. Call once at app startup.
 * Only does anything on native platforms.
 */
export async function initAdMob(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    // Dynamic import — only loads on native
    // @ts-ignore — module installed when Capacitor is set up
    const { AdMob } = await import(/* webpackIgnore: true */ '@capacitor-community/admob');
    await AdMob.initialize({
      initializeForTesting: true, // Set to false for production!
    });
    console.log('AdMob initialized');
  } catch (err) {
    console.warn('AdMob init failed:', err);
  }
}

/**
 * Show a rewarded video ad.
 * Returns true if the user completed the ad and earned the reward.
 * Returns false if the ad was skipped, failed, or we're on web (web uses AdModal instead).
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!isNativePlatform()) {
    // On web, the AdModal component handles the "ad" simulation
    return false;
  }

  try {
    // @ts-ignore — module installed when Capacitor is set up
    const { AdMob, RewardAdPluginEvents } = await import(/* webpackIgnore: true */ '@capacitor-community/admob');
    const platform = getPlatform();
    const adId = platform === 'ios'
      ? AD_UNIT_IDS.ios.rewarded
      : AD_UNIT_IDS.android.rewarded;

    return new Promise<boolean>(async (resolve) => {
      // Listen for reward event
      const rewardListener = AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        () => {
          rewardListener.remove();
          dismissListener.remove();
          resolve(true);
        }
      );

      // Listen for dismiss without reward
      const dismissListener = AdMob.addListener(
        RewardAdPluginEvents.Dismissed,
        () => {
          rewardListener.remove();
          dismissListener.remove();
          resolve(false);
        }
      );

      try {
        await AdMob.prepareRewardVideoAd({ adId });
        await AdMob.showRewardVideoAd();
      } catch (err) {
        rewardListener.remove();
        dismissListener.remove();
        console.warn('Rewarded ad failed:', err);
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('AdMob not available:', err);
    return false;
  }
}
