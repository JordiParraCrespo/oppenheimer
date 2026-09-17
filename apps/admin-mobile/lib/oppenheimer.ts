import { adminModules } from '@oppenheimer/frontend-admin';
import { OppenheimerApp } from '@oppenheimer/frontend-core/di';
import { createMobileAnalyticsClient, ExpoSecureStoreService } from '@oppenheimer/frontend-mobile';
import { mobileAuthClient } from './auth-client';

export const app = OppenheimerApp.create({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
  storage: new ExpoSecureStoreService(),
  authClient: mobileAuthClient,
  analytics: createMobileAnalyticsClient(),
  // Loading the admin product's modules is what makes this app that product.
  modules: adminModules,
});
