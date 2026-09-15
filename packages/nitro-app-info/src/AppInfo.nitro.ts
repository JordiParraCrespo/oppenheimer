import type { HybridObject } from 'react-native-nitro-modules';

export interface AppInfo extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  getNativeModuleName(): string;
}
