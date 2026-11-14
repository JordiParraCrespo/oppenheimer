import { consumerModules } from '@oppenheimer/frontend-consumer';
import { OppenheimerApp } from '@oppenheimer/frontend-core/di';
import { ExpoSecureStoreService } from '@oppenheimer/frontend-mobile';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiBaseUrl, mobileAuthClient } from './auth-client';

export const app = OppenheimerApp.create({
  apiBaseUrl,
  storage: new ExpoSecureStoreService(),
  authClient: mobileAuthClient,
  // What the API can target a flag on besides the session: this platform, at
  // this build.
  featureFlags: {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    appVersion: Constants.expoConfig?.version,
  },
  // Loading the consumer product's modules is what makes this app that product.
  modules: consumerModules,
});
