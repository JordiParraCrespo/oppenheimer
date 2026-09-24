import { consumerModules } from '@oppenheimer/frontend-consumer';
import { OppenheimerApp } from '@oppenheimer/frontend-core';
import { createWebAnalyticsClient, LocalStorageService } from '@oppenheimer/frontend-web';
import { webAuthClient } from './auth-client';

// Same-origin by default: the Vite dev server proxies `/api` to the API so the
// session cookie is sent with every request. Set VITE_API_URL only when the
// API is served from a different origin behind a shared domain in production.
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';

export const app = OppenheimerApp.create({
  apiBaseUrl,
  storage: new LocalStorageService(),
  authClient: webAuthClient,
  analytics: createWebAnalyticsClient(),
  // What the API can target a flag on besides the session: this is the web
  // client, at this build.
  featureFlags: { platform: 'web', appVersion: __APP_VERSION__ },
  // Loading the consumer product's modules is what makes this app that product.
  modules: consumerModules,
});
