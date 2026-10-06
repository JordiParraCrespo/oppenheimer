/**
 * i18next namespaces, one per product area. English filenames under
 * `{locale}/{namespace}.json` are the source of truth; `{locale}/index.json`
 * is assembled from them for the JSON export path.
 *
 * Call sites keep using dotted keys on the merged default namespace
 * (`t('auth.login')`). `resources` in `index.ts` also registers the same copy
 * under its area name (`t('login', { ns: 'auth' })`); the web app does not use
 * it and registers only the merged default namespace.
 */
import namespaceList from './namespaces.json';

export const namespaces = namespaceList as unknown as readonly [
  'common',
  'validation',
  'errors',
  'auth',
  'projects',
  'sessions',
  'automations',
  'pullRequests',
  'tasks',
  'calendar',
  'hosts',
  'settings',
  'nav',
  'language',
  'consent',
  'onboarding',
  'public',
  'theme',
  'toasts',
  'emails',
];

export type Namespace = (typeof namespaces)[number];
