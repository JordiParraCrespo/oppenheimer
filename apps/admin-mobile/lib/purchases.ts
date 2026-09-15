import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const apiKey =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const purchasesEnabled = Boolean(apiKey);

export async function initPurchases(): Promise<void> {
  if (!apiKey) return;
  try {
    Purchases.configure({ apiKey });
  } catch {
    // Missing store setup must not take the app down.
  }
}
