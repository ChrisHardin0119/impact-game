/**
 * In-App Purchase Bridge — handles ad removal purchase
 *
 * SETUP INSTRUCTIONS:
 * 1. Install a Capacitor IAP plugin: npm install @capgo/capacitor-purchases
 *    OR: npm install capacitor-purchases
 * 2. Configure your products in App Store Connect / Google Play Console
 * 3. Replace PRODUCT_ID with your actual product identifier
 * 4. Call initIAP() on app startup
 * 5. Use purchaseAdRemoval() when user taps "Remove Ads"
 * 6. Use restorePurchases() for the "Restore Purchases" button
 */

import { GameState } from './types';
import { isNativePlatform } from './adMobBridge';

// Product ID for ad removal — must match App Store / Play Store configuration
export const AD_REMOVAL_PRODUCT_ID = 'com.impact.idlegame.remove_ads';
export const AD_REMOVAL_PRICE = '$4.99';

/**
 * Initialize IAP. Call once at app startup.
 */
export async function initIAP(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    // This would initialize the IAP plugin
    // const { Purchases } = await import('@capgo/capacitor-purchases');
    // await Purchases.configure({ apiKey: 'YOUR_REVENUECAT_KEY' });
    console.log('IAP initialized (placeholder)');
  } catch (err) {
    console.warn('IAP init failed:', err);
  }
}

/**
 * Purchase ad removal.
 * Returns true if purchase was successful.
 */
export async function purchaseAdRemoval(): Promise<boolean> {
  if (!isNativePlatform()) {
    // On web, simulate a successful purchase for testing
    console.log('IAP: Web platform — simulating purchase');
    return true;
  }

  try {
    // Placeholder — replace with actual IAP implementation
    // const { Purchases } = await import('@capgo/capacitor-purchases');
    // const { customerInfo } = await Purchases.purchaseProduct({ productIdentifier: AD_REMOVAL_PRODUCT_ID });
    // return customerInfo.entitlements.active['ad_removal'] !== undefined;
    console.log('IAP: Purchase flow (placeholder)');
    return false;
  } catch (err) {
    console.warn('Purchase failed:', err);
    return false;
  }
}

/**
 * Restore previous purchases.
 * Returns updated GameState with adsRemoved set if applicable.
 */
export async function restorePurchases(state: GameState): Promise<GameState> {
  if (!isNativePlatform()) {
    console.log('IAP: Web platform — no purchases to restore');
    return state;
  }

  try {
    // Placeholder — replace with actual implementation
    // const { Purchases } = await import('@capgo/capacitor-purchases');
    // const { customerInfo } = await Purchases.restorePurchases();
    // if (customerInfo.entitlements.active['ad_removal']) {
    //   return { ...state, adsRemoved: true };
    // }
    return state;
  } catch (err) {
    console.warn('Restore failed:', err);
    return state;
  }
}
