import { OppenheimerApp } from '@oppenheimer/frontend/di';
import { createMobileAnalyticsClient } from './analytics';
import { mobileAuthClient } from './auth-client';
import { ExpoSecureStoreService } from './storage';

export const app = OppenheimerApp.create({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
  storage: new ExpoSecureStoreService(),
  authClient: mobileAuthClient,
  analytics: createMobileAnalyticsClient(),
});
