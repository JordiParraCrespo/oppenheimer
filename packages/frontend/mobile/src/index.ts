/**
 * @oppenheimer/frontend-mobile — what both Expo apps share below their routes.
 *
 * Organised by concern, each with the kind directories a feature has
 * (`components/`, `hooks/`, `lib/`). `platform`, `theme`, `config`, `forms`
 * and `analytics` are leaves; `i18n` and `layout` build on `platform`.
 * Nothing here imports a product package.
 *
 * `auth` is the one concern on top: it is the chrome both apps' sign-in screens
 * share, and it reaches down into `theme`, `forms` and `i18n`.
 *
 * Two modules run code at import time and are imported for that on their own:
 * `@oppenheimer/frontend-mobile/polyfills` (first thing in the entry file) and
 * `@oppenheimer/frontend-mobile/i18n` (first thing in the root layout).
 */
export * from './analytics';
export * from './auth';
export * from './config';
export * from './forms';
export * from './i18n';
export * from './layout';
export * from './platform';
export * from './theme';
